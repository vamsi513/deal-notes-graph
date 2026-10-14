import type { FactField } from '../extraction/types';

export interface Segment {
  text: string;
  highlighted: boolean;
}

interface Range {
  start: number;
  end: number;
}

/**
 * Split a sentence into plain and highlighted segments, one highlight per quoted span.
 * Matching is case insensitive but the original text is preserved, so the rendered sentence
 * reads exactly as it does in the note.
 */
export function highlightQuotes(sentence: string, quotes: string[]): Segment[] {
  const haystack = sentence.toLowerCase();
  const ranges: Range[] = [];
  for (const quote of quotes) {
    const needle = quote.trim().toLowerCase();
    if (needle === '') continue;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      ranges.push({ start: at, end: at + needle.length });
      from = at + needle.length;
    }
  }
  if (ranges.length === 0) return [{ text: sentence, highlighted: false }];

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: sentence.slice(cursor, range.start), highlighted: false });
    }
    segments.push({ text: sentence.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }
  if (cursor < sentence.length) {
    segments.push({ text: sentence.slice(cursor), highlighted: false });
  }
  return segments;
}

export interface SentenceFact {
  id: string;
  field: FactField;
  value: string;
  sourceSentenceIndex: number;
  quotedText: string;
  grounded: boolean;
  groundingReason: string;
}

export interface SentenceGroup {
  index: number;
  sentence: string;
  facts: SentenceFact[];
  segments: Segment[];
}

/**
 * Pair every sentence with the facts that were read from it, and precompute the highlighted
 * segments for that sentence. A fact whose quote is missing from its sentence still appears
 * beside it, with nothing highlighted, which is how an ungrounded fact shows up in the page.
 */
export function groupBySentence(sentences: string[], facts: SentenceFact[]): SentenceGroup[] {
  return sentences.map((sentence, index) => {
    const own = facts.filter((fact) => fact.sourceSentenceIndex === index);
    const quotes = own.filter((fact) => fact.grounded).map((fact) => fact.quotedText);
    return { index, sentence, facts: own, segments: highlightQuotes(sentence, quotes) };
  });
}

/** Facts that point outside the note, so the page can surface them rather than drop them. */
export function orphanFacts(sentences: string[], facts: SentenceFact[]): SentenceFact[] {
  return facts.filter(
    (fact) => fact.sourceSentenceIndex < 0 || fact.sourceSentenceIndex >= sentences.length,
  );
}

/** Field labels used in the interface. */
export const FIELD_LABELS: Record<FactField, string> = {
  CONTACT: 'Contact',
  COMPANY: 'Company',
  STAGE: 'Deal stage',
  AMOUNT: 'Amount',
  NEXT_STEP: 'Next step',
};

export const STAGE_LABELS: Record<string, string> = {
  PROSPECT: 'Prospect',
  DISCOVERY: 'Discovery',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed won',
  CLOSED_LOST: 'Closed lost',
};
