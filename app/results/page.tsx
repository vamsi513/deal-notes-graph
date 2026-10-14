import Link from 'next/link';

import { MeasuredResults } from '@/app/components/MeasuredResults';
import { measuredReport } from '@/src/evaluation/cached';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const report = await measuredReport();

  return (
    <>
      <h2>Measured results</h2>
      <p className="notice">
        The deterministic extractor run over all 30 sample notes and scored against the answer
        key in <code>data/key.json</code>. These numbers are computed on this request by the same
        code that writes <code>results/RESULTS.md</code>, so the page and the repository cannot
        disagree. The optional model extractor was not run and is in none of these numbers.
      </p>

      <div className="scroller">
        <table>
          <caption>The dataset</caption>
          <tbody>
            <tr>
              <th scope="row">notes</th>
              <td>{report.notes}</td>
            </tr>
            <tr>
              <th scope="row">facts in the key</th>
              <td>{report.keyFacts}</td>
            </tr>
            <tr>
              <th scope="row">facts the extractor produced</th>
              <td>{report.extractedFacts}</td>
            </tr>
            <tr>
              <th scope="row">facts the grounding check rejected</th>
              <td>{report.ungroundedFacts}</td>
            </tr>
            <tr>
              <th scope="row">right value and right sentence</th>
              <td>
                {report.sentenceIndexCorrect} of {report.sentenceIndexChecked}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <MeasuredResults report={report} />

      <p className="meta">
        <Link href="/">Back to the demo</Link>
      </p>
    </>
  );
}
