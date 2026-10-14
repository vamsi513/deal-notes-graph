import type { KeyEntry, NoteRecord } from '../data/datasets';
import { applyGrounding } from '../extraction/grounding';
import { normalize } from '../extraction/sentences';
import { FACT_FIELDS, type ExtractedFact, type Extractor, type FactField } from '../extraction/types';

export interface Failure {
  kind: 'missed' | 'wrong';
  noteId: string;
  field: FactField;
  detail: string;
}

export interface FieldMetrics {
  field: FactField;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface EvaluationReport {
  extractorName: string;
  notes: number;
  keyFacts: number;
  extractedFacts: number;
  ungroundedFacts: number;
  byField: FieldMetrics[];
  sentenceIndexChecked: number;
  sentenceIndexCorrect: number;
  failures: Failure[];
}

export function precision(m: FieldMetrics): number {
  const flagged = m.truePositives + m.falsePositives;
  return flagged === 0 ? 0 : m.truePositives / flagged;
}

export function recall(m: FieldMetrics): number {
  const actual = m.truePositives + m.falseNegatives;
  return actual === 0 ? 0 : m.truePositives / actual;
}

export function f1(m: FieldMetrics): number {
  const total = precision(m) + recall(m);
  return total === 0 ? 0 : (2 * precision(m) * recall(m)) / total;
}

/**
 * How a predicted fact is compared with a key fact.
 *
 * Contact, company, stage and amount are compared on their canonical value. A next step is a
 * free text span, and grading free text against one phrasing would measure wording rather
 * than extraction, so a next step is compared on the sentence it was taken from: the question
 * scored is whether the extractor found the sentence that states the next step.
 */
export function matchKey(field: FactField, value: string, sourceSentenceIndex: number): string {
  return field === 'NEXT_STEP' ? `sentence:${sourceSentenceIndex}` : normalize(value);
}

function group(facts: Array<{ field: FactField }>): Map<FactField, Array<{ field: FactField }>> {
  const out = new Map<FactField, Array<{ field: FactField }>>();
  for (const field of FACT_FIELDS) out.set(field, []);
  for (const fact of facts) out.get(fact.field)?.push(fact);
  return out;
}

export async function evaluate(
  extractor: Extractor,
  notes: NoteRecord[],
  key: Record<string, KeyEntry>,
): Promise<EvaluationReport> {
  const byField = new Map<FactField, FieldMetrics>(
    FACT_FIELDS.map((field) => [
      field,
      { field, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
    ]),
  );
  const failures: Failure[] = [];
  let keyFacts = 0;
  let extractedFacts = 0;
  let ungroundedFacts = 0;
  let sentenceIndexChecked = 0;
  let sentenceIndexCorrect = 0;

  for (const note of notes) {
    const entry = key[note.id];
    if (entry === undefined) throw new Error(`no key entry for ${note.id}`);
    const result = await extractor.extract({ subject: note.subject, body: note.body });
    const grounded = applyGrounding(result.facts, result.sentences);
    ungroundedFacts += grounded.filter((fact) => !fact.grounded).length;
    extractedFacts += result.facts.length;
    keyFacts += entry.facts.length;

    const predictedByField = group(result.facts) as Map<FactField, ExtractedFact[]>;
    const expectedByField = group(entry.facts) as Map<FactField, typeof entry.facts>;

    for (const field of FACT_FIELDS) {
      const metrics = byField.get(field);
      if (metrics === undefined) continue;
      const predicted = predictedByField.get(field) ?? [];
      const expected = expectedByField.get(field) ?? [];

      const expectedIndexByKey = new Map<string, number>();
      for (const fact of expected) {
        expectedIndexByKey.set(
          matchKey(field, fact.value, fact.sourceSentenceIndex),
          fact.sourceSentenceIndex,
        );
      }
      const predictedKeys = new Set<string>();

      for (const fact of predicted) {
        const candidate = matchKey(field, fact.value, fact.sourceSentenceIndex);
        predictedKeys.add(candidate);
        if (expectedIndexByKey.has(candidate)) {
          metrics.truePositives += 1;
          if (field !== 'NEXT_STEP') {
            sentenceIndexChecked += 1;
            if (expectedIndexByKey.get(candidate) === fact.sourceSentenceIndex) {
              sentenceIndexCorrect += 1;
            }
          }
        } else {
          metrics.falsePositives += 1;
          failures.push({
            kind: 'wrong',
            noteId: note.id,
            field,
            detail: describe(field, fact.value, fact.sourceSentenceIndex),
          });
        }
      }

      for (const fact of expected) {
        const candidate = matchKey(field, fact.value, fact.sourceSentenceIndex);
        if (!predictedKeys.has(candidate)) {
          metrics.falseNegatives += 1;
          failures.push({
            kind: 'missed',
            noteId: note.id,
            field,
            detail: describe(field, fact.value, fact.sourceSentenceIndex),
          });
        }
      }
    }
  }

  return {
    extractorName: extractor.name,
    notes: notes.length,
    keyFacts,
    extractedFacts,
    ungroundedFacts,
    byField: FACT_FIELDS.map((field) => {
      const metrics = byField.get(field);
      if (metrics === undefined) {
        return { field, truePositives: 0, falsePositives: 0, falseNegatives: 0 };
      }
      return metrics;
    }),
    sentenceIndexChecked,
    sentenceIndexCorrect,
    failures,
  };
}

function describe(field: FactField, value: string, index: number): string {
  return field === 'NEXT_STEP' ? `sentence ${index}: ${value}` : `${value} (sentence ${index})`;
}

export function totals(report: EvaluationReport): FieldMetrics {
  return report.byField.reduce<FieldMetrics>(
    (acc, metrics) => ({
      field: acc.field,
      truePositives: acc.truePositives + metrics.truePositives,
      falsePositives: acc.falsePositives + metrics.falsePositives,
      falseNegatives: acc.falseNegatives + metrics.falseNegatives,
    }),
    { field: 'CONTACT', truePositives: 0, falsePositives: 0, falseNegatives: 0 },
  );
}
