import { describe, expect, it } from 'vitest';

import { applyGrounding, checkFactGrounding } from '../src/extraction/grounding';
import type { ExtractedFact } from '../src/extraction/types';

const sentences = [
  'They are in discovery and asked for a quote around $40,000.',
  'We will send the revised quote on Thursday.',
];

function fact(overrides: Partial<ExtractedFact>): ExtractedFact {
  return {
    field: 'STAGE',
    value: 'DISCOVERY',
    sourceSentenceIndex: 0,
    quotedText: 'discovery',
    ...overrides,
  };
}

describe('checkFactGrounding', () => {
  it('accepts a stage quoted from its sentence', () => {
    expect(checkFactGrounding(fact({}), sentences).grounded).toBe(true);
  });

  it('rejects a sentence index outside the note', () => {
    const verdict = checkFactGrounding(fact({ sourceSentenceIndex: 9 }), sentences);
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('outside the note');
  });

  it('rejects a quote that is not in the sentence', () => {
    const verdict = checkFactGrounding(fact({ quotedText: 'negotiation' }), sentences);
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('does not appear');
  });

  it('rejects an empty quote', () => {
    const verdict = checkFactGrounding(fact({ quotedText: '  ' }), sentences);
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('empty');
  });

  it('rejects an amount that disagrees with its quote', () => {
    const verdict = checkFactGrounding(
      fact({ field: 'AMOUNT', value: '50000.00 USD', quotedText: '$40,000' }),
      sentences,
    );
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('40000.00 USD');
  });

  it('accepts an amount that matches its quote exactly', () => {
    expect(
      checkFactGrounding(
        fact({ field: 'AMOUNT', value: '40000.00 USD', quotedText: '$40,000' }),
        sentences,
      ).grounded,
    ).toBe(true);
  });

  it('rejects a stage that disagrees with its quote', () => {
    const verdict = checkFactGrounding(
      fact({ value: 'NEGOTIATION', quotedText: 'discovery' }),
      sentences,
    );
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('names DISCOVERY');
  });

  it('rejects a contact whose name is not in the quote', () => {
    const verdict = checkFactGrounding(
      fact({ field: 'CONTACT', value: 'Imani Dorsey', quotedText: 'discovery' }),
      sentences,
    );
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('contact name');
  });

  it('accepts a contact quoted as an email address', () => {
    expect(
      checkFactGrounding(
        {
          field: 'CONTACT',
          value: 'Petra Walsh',
          sourceSentenceIndex: 0,
          quotedText: 'petra.walsh@harbor-lane.example',
        },
        ['Cc petra.walsh@harbor-lane.example on the thread.'],
      ).grounded,
    ).toBe(true);
  });

  it('rejects a company name that is not in the quote', () => {
    const verdict = checkFactGrounding(
      fact({ field: 'COMPANY', value: 'Pinegate Systems', quotedText: 'discovery' }),
      sentences,
    );
    expect(verdict.grounded).toBe(false);
    expect(verdict.reason).toContain('company name');
  });
});

describe('applyGrounding', () => {
  it('annotates every fact and leaves the list the same length', () => {
    const annotated = applyGrounding([fact({}), fact({ quotedText: 'not in here' })], sentences);
    expect(annotated).toHaveLength(2);
    expect(annotated.map((item) => item.grounded)).toEqual([true, false]);
    expect(annotated[1]?.groundingReason.length).toBeGreaterThan(0);
  });
});
