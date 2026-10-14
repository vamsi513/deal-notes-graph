import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadKey } from '../src/data/datasets';
import { measuredReport } from '../src/evaluation/cached';
import { f1, precision, recall, totals } from '../src/evaluation/evaluate';
import { formatReport } from '../src/evaluation/report';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const published = readFileSync(join(repoRoot, 'results/RESULTS.md'), 'utf8');

/**
 * The pages score the extractor live rather than reading numbers typed into a component, so
 * the only way the site and the repository can disagree is if the committed report is stale.
 * These assertions are what makes that impossible to miss.
 */
describe('the numbers the pages show', () => {
  it('reproduce the committed report exactly', async () => {
    const trickyCount = Object.values(loadKey()).filter((entry) => entry.tricky !== null).length;
    expect(formatReport(await measuredReport(), trickyCount)).toBe(published);
  });

  it('are the overall precision and recall the published table states', async () => {
    const overall = totals(await measuredReport());
    expect(
      published.includes(
        `| **all fields** | ${precision(overall).toFixed(3)} | ${recall(overall).toFixed(3)} | ${f1(overall).toFixed(3)} |`,
      ),
    ).toBe(true);
  });

  it('include every failure the published report lists', async () => {
    const report = await measuredReport();
    expect(report.failures.length).toBeGreaterThan(0);
    for (const failure of report.failures) {
      expect(published).toContain(failure.detail);
      expect(published).toContain(failure.noteId);
    }
  });

  it('come from one memoised run, so a page render does not rescore', async () => {
    expect(await measuredReport()).toBe(await measuredReport());
  });
});
