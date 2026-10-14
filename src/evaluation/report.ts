import type { EvaluationReport } from './evaluate';
import { f1, precision, recall, totals } from './evaluate';

const FIELD_LABELS: Record<string, string> = {
  CONTACT: 'contact',
  COMPANY: 'company',
  STAGE: 'stage',
  AMOUNT: 'amount',
  NEXT_STEP: 'next step',
};

export function formatReport(report: EvaluationReport, trickyCount: number): string {
  const overall = totals(report);
  const lines: string[] = [];
  lines.push('# Measured results');
  lines.push('');
  lines.push(
    'Produced by `npm run evaluate`. The deterministic rule based extractor was run over all ' +
      '30 notes in `data/notes/` and scored against the hand authored key in `data/key.json`. ' +
      'The optional model extractor was not run and is not part of these numbers.',
  );
  lines.push('');
  lines.push('## Dataset');
  lines.push('');
  lines.push('| Quantity | Count |');
  lines.push('| --- | --- |');
  lines.push(`| notes | ${report.notes} |`);
  lines.push(`| facts in the key | ${report.keyFacts} |`);
  lines.push(`| notes with a tricky case | ${trickyCount} |`);
  lines.push(`| facts the extractor produced | ${report.extractedFacts} |`);
  lines.push(`| facts the grounding check rejected | ${report.ungroundedFacts} |`);
  lines.push('');
  lines.push('## Per field results');
  lines.push('');
  lines.push(
    'Contact, company, stage and amount are scored on the canonical value. A next step is ' +
      'scored on whether the extractor picked the sentence that states it, because grading a ' +
      'free text span against one phrasing would measure wording rather than extraction.',
  );
  lines.push('');
  lines.push('| Field | Precision | Recall | F1 | Correct | Wrong | Missed |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const metrics of report.byField) {
    lines.push(
      `| ${FIELD_LABELS[metrics.field] ?? metrics.field} | ${precision(metrics).toFixed(3)} | ` +
        `${recall(metrics).toFixed(3)} | ${f1(metrics).toFixed(3)} | ${metrics.truePositives} | ` +
        `${metrics.falsePositives} | ${metrics.falseNegatives} |`,
    );
  }
  lines.push(
    `| **all fields** | ${precision(overall).toFixed(3)} | ${recall(overall).toFixed(3)} | ` +
      `${f1(overall).toFixed(3)} | ${overall.truePositives} | ${overall.falsePositives} | ` +
      `${overall.falseNegatives} |`,
  );
  lines.push('');
  lines.push('## Source sentence');
  lines.push('');
  const rate =
    report.sentenceIndexChecked === 0
      ? 0
      : report.sentenceIndexCorrect / report.sentenceIndexChecked;
  lines.push(
    `Of the ${report.sentenceIndexChecked} value matched facts the extractor got right, ` +
      `${report.sentenceIndexCorrect} also cite the same sentence the key records, a rate of ` +
      `${rate.toFixed(3)}.`,
  );
  lines.push('');
  lines.push('## Every failure');
  lines.push('');
  if (report.failures.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Kind | Note | Field | Detail |');
    lines.push('| --- | --- | --- | --- |');
    for (const failure of report.failures) {
      lines.push(
        `| ${failure.kind} | ${failure.noteId} | ${FIELD_LABELS[failure.field] ?? failure.field} | ` +
          `${failure.detail} |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}
