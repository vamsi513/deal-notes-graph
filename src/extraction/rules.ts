import {
  COMPANY_SUFFIXES,
  CONTACT_LEAD_CUES,
  CONTACT_TRAIL_CUES,
  NAME_STOPWORDS,
  NEXT_STEP_CUES,
  STAGE_PATTERNS,
  STAGE_STATEMENT_CUES,
} from './lexicon';
import { isNegated } from './negation';
import { normalize, splitSentences } from './sentences';
import { CURRENCY_PREFIXED, CURRENCY_SUFFIXED, amountToCents, formatAmount } from './values';
import type { ExtractedFact, ExtractionInput, ExtractionResult, Extractor } from './types';

const PERSON_NAME = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
const WORK_EMAIL = /\b([a-z]+)\.([a-z]+)@[a-z0-9.-]+\.example\b/g;
const COMPANY_NAME = new RegExp(
  `\\b((?:[A-Z][A-Za-z&]*\\s+){0,3}(?:${COMPANY_SUFFIXES.join('|')}))\\b`,
  'g',
);
const MODAL_CUE = /^(?:we will|i will|we'll|i'll|plan to|planning to|going to|scheduled to)$/i;
const HEADER_CUE = /^(?:next steps?|action item)$/i;

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function nextWordIsCompanySuffix(sentence: string, endIndex: number): boolean {
  const rest = sentence.slice(endIndex).trimStart();
  const word = /^[A-Za-z&]+/.exec(rest)?.[0];
  return word !== undefined && (COMPANY_SUFFIXES as readonly string[]).includes(word);
}

function extractContacts(sentences: string[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  const add = (value: string, index: number, quotedText: string): void => {
    const key = normalize(value);
    if (seen.has(key)) return;
    seen.add(key);
    facts.push({ field: 'CONTACT', value, sourceSentenceIndex: index, quotedText });
  };

  sentences.forEach((sentence, index) => {
    for (const match of sentence.matchAll(WORK_EMAIL)) {
      const [whole, first, last] = match;
      if (first === undefined || last === undefined) continue;
      add(`${titleCase(first)} ${titleCase(last)}`, index, whole);
    }
    for (const match of sentence.matchAll(PERSON_NAME)) {
      const [whole, first, last] = match;
      if (whole === undefined || first === undefined || last === undefined) continue;
      if (match.index === undefined) continue;
      if (NAME_STOPWORDS.has(first) || NAME_STOPWORDS.has(last)) continue;
      const end = match.index + whole.length;
      if (nextWordIsCompanySuffix(sentence, end)) continue;
      const before = sentence.slice(0, match.index);
      const after = sentence.slice(end);
      if (!CONTACT_LEAD_CUES.test(before) && !CONTACT_TRAIL_CUES.test(after)) continue;
      add(whole, index, whole);
    }
  });
  return facts;
}

function extractCompanies(sentences: string[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  sentences.forEach((sentence, index) => {
    for (const match of sentence.matchAll(COMPANY_NAME)) {
      const value = match[1]?.trim();
      if (value === undefined || value === '') continue;
      const key = normalize(value);
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({ field: 'COMPANY', value, sourceSentenceIndex: index, quotedText: value });
    }
  });
  return facts;
}

/**
 * Stage selection. An explicit statement of the stage beats an incidental mention, and among
 * matches of the same kind the last one in the note wins. That last part is what makes a
 * reversal such as "no longer in negotiation, back to discovery" come out as DISCOVERY.
 */
function extractStage(sentences: string[]): ExtractedFact[] {
  let explicit: ExtractedFact | null = null;
  let incidental: ExtractedFact | null = null;
  sentences.forEach((sentence, index) => {
    const matches: Array<{ position: number; fact: ExtractedFact; isExplicit: boolean }> = [];
    for (const { stage, pattern } of STAGE_PATTERNS) {
      for (const match of sentence.matchAll(pattern)) {
        if (match.index === undefined) continue;
        if (isNegated(sentence, match.index)) continue;
        matches.push({
          position: match.index,
          isExplicit: STAGE_STATEMENT_CUES.test(sentence.slice(0, match.index)),
          fact: {
            field: 'STAGE',
            value: stage,
            sourceSentenceIndex: index,
            quotedText: match[0],
          },
        });
      }
    }
    matches.sort((a, b) => a.position - b.position);
    for (const match of matches) {
      if (match.isExplicit) explicit = match.fact;
      else incidental = match.fact;
    }
  });
  const chosen = explicit ?? incidental;
  return chosen === null ? [] : [chosen];
}

/** The last amount that is not negated wins, which is what makes a changed amount work. */
function extractAmount(sentences: string[]): ExtractedFact[] {
  let chosen: ExtractedFact | null = null;
  sentences.forEach((sentence, index) => {
    for (const pattern of [CURRENCY_PREFIXED, CURRENCY_SUFFIXED]) {
      for (const match of sentence.matchAll(pattern)) {
        const digits = match[1];
        if (digits === undefined || match.index === undefined) continue;
        if (isNegated(sentence, match.index)) continue;
        chosen = {
          field: 'AMOUNT',
          value: formatAmount(amountToCents(digits, match[2])),
          sourceSentenceIndex: index,
          quotedText: match[0].trim(),
        };
      }
    }
  });
  return chosen === null ? [] : [chosen];
}

function extractNextStep(sentences: string[]): ExtractedFact[] {
  let chosen: ExtractedFact | null = null;
  sentences.forEach((sentence, index) => {
    const match = NEXT_STEP_CUES.exec(sentence);
    if (match === null || match.index === undefined) return;
    const cue = match[0];
    if (isNegated(sentence, match.index)) return;
    const tail = sentence.slice(match.index + cue.length);
    let value: string;
    if (MODAL_CUE.test(cue)) {
      value = tail.trim();
    } else if (HEADER_CUE.test(cue)) {
      value = tail.replace(/^\s*(?:is|are|:|-)\s*/i, '').trim();
    } else {
      value = sentence.slice(match.index).trim();
    }
    value = value.replace(/[.!?]+$/, '').trim();
    if (value === '') return;
    chosen = {
      field: 'NEXT_STEP',
      value,
      sourceSentenceIndex: index,
      quotedText: sentence.slice(match.index).trim(),
    };
  });
  return chosen === null ? [] : [chosen];
}

/** Deterministic extractor. No model, no network, no credential. */
export class RuleBasedExtractor implements Extractor {
  readonly name = 'rule-based';

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const sentences = splitSentences(input.body);
    const facts = [
      ...extractContacts(sentences),
      ...extractCompanies(sentences),
      ...extractStage(sentences),
      ...extractAmount(sentences),
      ...extractNextStep(sentences),
    ].sort(
      (a, b) => a.sourceSentenceIndex - b.sourceSentenceIndex || a.field.localeCompare(b.field),
    );
    return { extractorName: this.name, sentences, facts };
  }
}
