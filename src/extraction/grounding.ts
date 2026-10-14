import { normalize } from './sentences';
import type { ExtractedFact } from './types';
import { parseAmountCents, stageFromText } from './values';

export interface GroundedFact extends ExtractedFact {
  grounded: boolean;
  groundingReason: string;
}

/**
 * Check that a fact is actually in the note it claims to come from.
 *
 * The rules are deliberately strict. The quoted text must appear verbatim in the sentence the
 * fact points at, an amount must reparse from the quoted text to the same value, and a stage
 * must be the stage the quoted text names. A fact that passes is one a reader can verify by
 * looking at the highlighted sentence.
 */
export function checkFactGrounding(
  fact: ExtractedFact,
  sentences: string[],
): { grounded: boolean; reason: string } {
  const sentence = sentences[fact.sourceSentenceIndex];
  if (sentence === undefined) {
    return { grounded: false, reason: 'source sentence index is outside the note' };
  }
  if (fact.quotedText.trim() === '') {
    return { grounded: false, reason: 'quoted text is empty' };
  }
  if (!normalize(sentence).includes(normalize(fact.quotedText))) {
    return { grounded: false, reason: 'quoted text does not appear in the source sentence' };
  }

  switch (fact.field) {
    case 'AMOUNT': {
      const cents = parseAmountCents(fact.quotedText);
      if (cents === null) {
        return { grounded: false, reason: 'quoted text contains no amount' };
      }
      const expected = `${(cents / 100).toFixed(2)} USD`;
      if (expected !== fact.value) {
        return { grounded: false, reason: `quoted text reads ${expected}, not ${fact.value}` };
      }
      return { grounded: true, reason: 'amount matches the quoted text' };
    }
    case 'STAGE': {
      const stage = stageFromText(fact.quotedText);
      if (stage === null) {
        return { grounded: false, reason: 'quoted text names no stage' };
      }
      if (stage !== fact.value) {
        return { grounded: false, reason: `quoted text names ${stage}, not ${fact.value}` };
      }
      return { grounded: true, reason: 'stage matches the quoted text' };
    }
    case 'CONTACT': {
      const quoted = normalize(fact.quotedText);
      const asName = normalize(fact.value);
      const asEmailLocal = asName.replace(/\s+/g, '.');
      if (!quoted.includes(asName) && !quoted.includes(asEmailLocal)) {
        return { grounded: false, reason: 'contact name is not in the quoted text' };
      }
      return { grounded: true, reason: 'contact name is in the quoted text' };
    }
    case 'COMPANY': {
      if (!normalize(fact.quotedText).includes(normalize(fact.value))) {
        return { grounded: false, reason: 'company name is not in the quoted text' };
      }
      return { grounded: true, reason: 'company name is in the quoted text' };
    }
    case 'NEXT_STEP':
      return { grounded: true, reason: 'next step is quoted from the source sentence' };
  }
}

export function applyGrounding(facts: ExtractedFact[], sentences: string[]): GroundedFact[] {
  return facts.map((fact) => {
    const { grounded, reason } = checkFactGrounding(fact, sentences);
    return { ...fact, grounded, groundingReason: reason };
  });
}
