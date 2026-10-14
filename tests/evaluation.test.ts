import { describe, expect, it } from 'vitest';

import { loadKey, loadNotes } from '../src/data/datasets';
import { evaluate, f1, matchKey, precision, recall, totals } from '../src/evaluation/evaluate';
import { formatReport } from '../src/evaluation/report';
import { RuleBasedExtractor } from '../src/extraction/rules';
import type { ExtractionInput, ExtractionResult, Extractor } from '../src/extraction/types';
import { splitSentences } from '../src/extraction/sentences';

const notes = loadNotes();
const key = loadKey();

/** An extractor that replays the key, used to prove the harness can score a perfect run. */
class PerfectExtractor implements Extractor {
  readonly name = 'perfect';

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const sentences = splitSentences(input.body);
    const note = notes.find((candidate) => candidate.body === input.body);
    const entry = note === undefined ? undefined : key[note.id];
    return {
      extractorName: this.name,
      sentences,
      facts: (entry?.facts ?? []).map((fact) => ({
        field: fact.field,
        value: fact.value,
        sourceSentenceIndex: fact.sourceSentenceIndex,
        quotedText: sentences[fact.sourceSentenceIndex] ?? '',
      })),
    };
  }
}

/** An extractor that finds nothing, used to prove recall collapses to zero. */
class EmptyExtractor implements Extractor {
  readonly name = 'empty';

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    return { extractorName: this.name, sentences: splitSentences(input.body), facts: [] };
  }
}

describe('metric arithmetic', () => {
  it('computes precision, recall and f1', () => {
    const metrics = {
      field: 'STAGE' as const,
      truePositives: 8,
      falsePositives: 2,
      falseNegatives: 2,
    };
    expect(precision(metrics)).toBeCloseTo(0.8);
    expect(recall(metrics)).toBeCloseTo(0.8);
    expect(f1(metrics)).toBeCloseTo(0.8);
  });

  it('returns zero rather than dividing by zero', () => {
    const metrics = {
      field: 'STAGE' as const,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
    };
    expect(precision(metrics)).toBe(0);
    expect(recall(metrics)).toBe(0);
    expect(f1(metrics)).toBe(0);
  });
});

describe('matchKey', () => {
  it('compares most fields on their value', () => {
    expect(matchKey('AMOUNT', '32000.00 USD', 2)).toBe('32000.00 usd');
  });

  it('compares a next step on its sentence', () => {
    expect(matchKey('NEXT_STEP', 'send the quote', 3)).toBe('sentence:3');
  });
});

describe('evaluate', () => {
  it('scores a perfect extractor at one', async () => {
    const report = await evaluate(new PerfectExtractor(), notes, key);
    const overall = totals(report);
    expect(overall.falsePositives).toBe(0);
    expect(overall.falseNegatives).toBe(0);
    expect(precision(overall)).toBe(1);
    expect(recall(overall)).toBe(1);
    expect(report.failures).toHaveLength(0);
  });

  it('scores an empty extractor at zero recall and misses every key fact', async () => {
    const report = await evaluate(new EmptyExtractor(), notes, key);
    const overall = totals(report);
    expect(overall.truePositives).toBe(0);
    expect(overall.falseNegatives).toBe(report.keyFacts);
    expect(recall(overall)).toBe(0);
    expect(report.failures.every((failure) => failure.kind === 'missed')).toBe(true);
  });

  it('counts every note and every key fact once', async () => {
    const report = await evaluate(new RuleBasedExtractor(), notes, key);
    const overall = totals(report);
    expect(report.notes).toBe(30);
    expect(report.keyFacts).toBe(
      Object.values(key).reduce((sum, entry) => sum + entry.facts.length, 0),
    );
    expect(overall.truePositives + overall.falseNegatives).toBe(report.keyFacts);
  });

  it('records a failure row for every miss and every wrong fact', async () => {
    const report = await evaluate(new RuleBasedExtractor(), notes, key);
    const overall = totals(report);
    expect(report.failures).toHaveLength(overall.falsePositives + overall.falseNegatives);
    for (const failure of report.failures) {
      expect(Object.keys(key)).toContain(failure.noteId);
    }
  });

  it('finds no ungrounded fact, because the rules quote verbatim', async () => {
    const report = await evaluate(new RuleBasedExtractor(), notes, key);
    expect(report.ungroundedFacts).toBe(0);
  });

  it('throws when a note has no key entry', async () => {
    await expect(evaluate(new RuleBasedExtractor(), notes, {})).rejects.toThrow(/no key entry/);
  });
});

describe('formatReport', () => {
  it('writes the dataset, per field and failure sections', async () => {
    const report = await evaluate(new RuleBasedExtractor(), notes, key);
    const markdown = formatReport(report, 9);
    expect(markdown).toContain('# Measured results');
    expect(markdown).toContain('## Per field results');
    expect(markdown).toContain('## Every failure');
    expect(markdown).toContain('| next step |');
    expect(markdown).toContain('| notes | 30 |');
  });

  it('says so plainly when there is nothing to report', async () => {
    const report = await evaluate(new PerfectExtractor(), notes, key);
    expect(formatReport(report, 9)).toContain('None.');
  });
});
