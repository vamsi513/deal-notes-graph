import { describe, expect, it } from 'vitest';

import { normalize, splitClauses, splitSentences } from '../src/extraction/sentences';

describe('splitSentences', () => {
  it('splits on full stops', () => {
    expect(splitSentences('They are in discovery. Budget is unclear. We will follow up.')).toEqual([
      'They are in discovery.',
      'Budget is unclear.',
      'We will follow up.',
    ]);
  });

  it('keeps a decimal amount in one sentence', () => {
    expect(splitSentences('The figure is $12,500.50 for year one.')).toEqual([
      'The figure is $12,500.50 for year one.',
    ]);
  });

  it('does not split on a known abbreviation', () => {
    expect(splitSentences('The budget is approx. $40,000 for now.')).toEqual([
      'The budget is approx. $40,000 for now.',
    ]);
  });

  it('collapses newlines and runs of spaces', () => {
    expect(splitSentences('First line.\n\n   Second    line.')).toEqual([
      'First line.',
      'Second line.',
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   \n  ')).toEqual([]);
  });

  it('keeps trailing text that has no full stop', () => {
    expect(splitSentences('We signed. Kickoff next week')).toEqual([
      'We signed.',
      'Kickoff next week',
    ]);
  });
});

describe('normalize', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalize('  Harbor   Lane\tLOGISTICS ')).toBe('harbor lane logistics');
  });
});

describe('splitClauses', () => {
  it('splits on punctuation and contrastive conjunctions', () => {
    expect(splitClauses('It was $40,000 but that changed, so we repriced')).toEqual([
      'It was $40,000',
      'that changed',
      'we repriced',
    ]);
  });
});
