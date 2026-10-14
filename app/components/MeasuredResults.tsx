import Link from 'next/link';

import { f1, precision, recall, totals } from '@/src/evaluation/evaluate';
import type { EvaluationReport } from '@/src/evaluation/evaluate';

const FIELD_LABELS: Record<string, string> = {
  CONTACT: 'contact',
  COMPANY: 'company',
  STAGE: 'stage',
  AMOUNT: 'amount',
  NEXT_STEP: 'next step',
};

export function MeasuredResults({
  report,
  compact = false,
}: {
  report: EvaluationReport;
  compact?: boolean;
}) {
  const overall = totals(report);
  return (
    <>
      <div className="scoreline">
        <div className="score">
          <span className="score-value">{precision(overall).toFixed(3)}</span>
          <span className="score-label">precision</span>
        </div>
        <div className="score">
          <span className="score-value">{recall(overall).toFixed(3)}</span>
          <span className="score-label">recall</span>
        </div>
        <div className="score">
          <span className="score-value">{report.keyFacts}</span>
          <span className="score-label">facts in the key</span>
        </div>
        <div className="score">
          <span className="score-value">{report.notes}</span>
          <span className="score-label">notes</span>
        </div>
      </div>

      <div className="scroller">
        <table>
          <caption>
            Deterministic extractor scored against the hand authored key. Contact, company, stage
            and amount are scored on the value. A next step is scored on whether the right sentence
            was found, not on its wording.
          </caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">F1</th>
              <th scope="col">Correct</th>
              <th scope="col">Wrong</th>
              <th scope="col">Missed</th>
            </tr>
          </thead>
          <tbody>
            {report.byField.map((metrics) => (
              <tr key={metrics.field}>
                <th scope="row">{FIELD_LABELS[metrics.field] ?? metrics.field}</th>
                <td>{precision(metrics).toFixed(3)}</td>
                <td>{recall(metrics).toFixed(3)}</td>
                <td>{f1(metrics).toFixed(3)}</td>
                <td>{metrics.truePositives}</td>
                <td>{metrics.falsePositives}</td>
                <td>{metrics.falseNegatives}</td>
              </tr>
            ))}
            <tr className="total">
              <th scope="row">all fields</th>
              <td>{precision(overall).toFixed(3)}</td>
              <td>{recall(overall).toFixed(3)}</td>
              <td>{f1(overall).toFixed(3)}</td>
              <td>{overall.truePositives}</td>
              <td>{overall.falsePositives}</td>
              <td>{overall.falseNegatives}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Every failure, all {report.failures.length} of them</h3>
      <p className="meta">
        Nothing is hidden here. The lexicon was written before the scoring run and deliberately not
        patched afterwards, so these are the real misses rather than a tuned result.
      </p>
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">Note</th>
              <th scope="col">Field</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {report.failures.map((failure) => (
              <tr key={`${failure.noteId}-${failure.field}-${failure.kind}`}>
                <td>{failure.kind}</td>
                <td>
                  <Link href={`/notes/${failure.noteId}`}>{failure.noteId}</Link>
                </td>
                <td>{FIELD_LABELS[failure.field] ?? failure.field}</td>
                <td>{failure.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compact ? (
        <p className="meta">
          <Link href="/results">The full scoring report, including the dataset counts</Link>
        </p>
      ) : null}
    </>
  );
}
