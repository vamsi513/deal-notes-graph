import { loadKey, loadNotes } from '../data/datasets';
import { RuleBasedExtractor } from '../extraction/rules';
import { evaluate, type EvaluationReport } from './evaluate';

let cached: Promise<EvaluationReport> | null = null;

/**
 * The measured scoring run, computed once per process.
 *
 * The pages run the real evaluation rather than reading numbers copied into the page, so what
 * a visitor sees is produced by the same code that writes results/RESULTS.md and cannot drift
 * from it. A test asserts the two agree.
 */
export function measuredReport(): Promise<EvaluationReport> {
  if (cached === null) {
    cached = evaluate(new RuleBasedExtractor(), loadNotes(), loadKey());
  }
  return cached;
}
