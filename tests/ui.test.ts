import { describe, expect, it } from 'vitest';

import { FIELD_LABELS, groupBySentence, highlightQuotes, orphanFacts } from '../src/ui/highlight';
import type { SentenceFact } from '../src/ui/highlight';
import { formatDate, sourceLabel } from '../src/ui/format';
import { FACT_FIELDS } from '../src/extraction/types';

const sentence = 'They are in discovery and asked for a quote around $40,000.';

function fact(overrides: Partial<SentenceFact> = {}): SentenceFact {
  return {
    id: 'f1',
    field: 'STAGE',
    value: 'DISCOVERY',
    sourceSentenceIndex: 0,
    quotedText: 'discovery',
    grounded: true,
    groundingReason: 'ok',
    ...overrides,
  };
}

describe('highlightQuotes', () => {
  it('splits a sentence around the quoted span', () => {
    expect(highlightQuotes(sentence, ['discovery'])).toEqual([
      { text: 'They are in ', highlighted: false },
      { text: 'discovery', highlighted: true },
      { text: ' and asked for a quote around $40,000.', highlighted: false },
    ]);
  });

  it('returns the whole sentence when nothing matches', () => {
    expect(highlightQuotes(sentence, ['negotiation'])).toEqual([
      { text: sentence, highlighted: false },
    ]);
  });

  it('ignores an empty quote', () => {
    expect(highlightQuotes(sentence, ['   '])).toEqual([{ text: sentence, highlighted: false }]);
  });

  it('matches without regard to case but keeps the original text', () => {
    const segments = highlightQuotes('Pinegate Systems is in discovery.', ['pinegate systems']);
    expect(segments[0]).toEqual({ text: 'Pinegate Systems', highlighted: true });
  });

  it('merges overlapping quotes into one highlight', () => {
    const segments = highlightQuotes('a quote around $40,000.', ['quote around', 'around $40,000']);
    expect(segments.filter((segment) => segment.highlighted)).toHaveLength(1);
    expect(segments.find((segment) => segment.highlighted)?.text).toBe('quote around $40,000');
  });

  it('highlights every occurrence of a repeated quote', () => {
    const segments = highlightQuotes('quote now, quote later', ['quote']);
    expect(segments.filter((segment) => segment.highlighted)).toHaveLength(2);
  });
});

describe('groupBySentence', () => {
  it('attaches each fact to the sentence it came from', () => {
    const groups = groupBySentence(
      [sentence, 'We will follow up.'],
      [
        fact(),
        fact({
          id: 'f2',
          field: 'NEXT_STEP',
          value: 'follow up',
          sourceSentenceIndex: 1,
          quotedText: 'follow up',
        }),
      ],
    );
    expect(groups[0]?.facts.map((item) => item.id)).toEqual(['f1']);
    expect(groups[1]?.facts.map((item) => item.id)).toEqual(['f2']);
  });

  it('shows an ungrounded fact beside its sentence with nothing highlighted', () => {
    const groups = groupBySentence([sentence], [fact({ grounded: false, quotedText: 'absent' })]);
    expect(groups[0]?.facts).toHaveLength(1);
    expect(groups[0]?.segments.some((segment) => segment.highlighted)).toBe(false);
  });

  it('leaves a sentence with no facts empty', () => {
    const groups = groupBySentence([sentence, 'Nothing here.'], [fact()]);
    expect(groups[1]?.facts).toEqual([]);
  });
});

describe('orphanFacts', () => {
  it('finds a fact that points outside the note', () => {
    expect(orphanFacts([sentence], [fact({ sourceSentenceIndex: 4 })])).toHaveLength(1);
  });

  it('finds nothing when every fact is in range', () => {
    expect(orphanFacts([sentence], [fact()])).toEqual([]);
  });
});

describe('labels and formatting', () => {
  it('labels every fact field', () => {
    for (const field of FACT_FIELDS) expect(FIELD_LABELS[field]).toBeTruthy();
  });

  it('formats a date in a fixed locale', () => {
    expect(formatDate('2026-02-03T09:15:00.000Z')).toBe('03 Feb 2026');
  });

  it('labels the note source', () => {
    expect(sourceLabel('EMAIL')).toBe('Email');
    expect(sourceLabel('MEETING')).toBe('Meeting note');
  });
});
