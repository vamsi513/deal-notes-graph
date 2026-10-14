import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { loadKey, loadNotes } from '../src/data/datasets';
import { evaluate } from '../src/evaluation/evaluate';
import { formatReport } from '../src/evaluation/report';
import { RuleBasedExtractor } from '../src/extraction/rules';

async function main(): Promise<void> {
  const notes = loadNotes();
  const key = loadKey();
  const trickyCount = Object.values(key).filter((entry) => entry.tricky !== null).length;
  // The evaluation always uses the deterministic extractor so the numbers are reproducible
  // and need no credential.
  const report = await evaluate(new RuleBasedExtractor(), notes, key);
  const markdown = formatReport(report, trickyCount);
  process.stdout.write(markdown);

  const outIndex = process.argv.indexOf('--out');
  if (outIndex !== -1) {
    const target = process.argv[outIndex + 1];
    if (target === undefined) throw new Error('--out needs a path');
    const path = resolve(target);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown, 'utf8');
    process.stdout.write(`\nwritten to ${target}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
