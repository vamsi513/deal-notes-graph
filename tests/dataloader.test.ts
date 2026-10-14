import { afterEach, describe, expect, it } from 'vitest';

import { createHarness, type Harness } from './helpers';

let harness: Harness;

afterEach(async () => {
  await harness?.stop();
});

/**
 * These are the N plus one tests. The in memory repository counts how many times each batch
 * read is called, so a query that walks 30 notes to their facts must still produce exactly
 * one factsByNoteIds call.
 */
describe('request batching', () => {
  it('reads the facts of every note in one batch', async () => {
    harness = await createHarness();
    harness.repository.resetCounters();
    const data = await harness.run<{ notes: Array<{ facts: Array<{ field: string }> }> }>(
      `{ notes(limit: 50) { id facts { field } } }`,
    );
    expect(data.notes).toHaveLength(30);
    expect(harness.repository.batchCalls.listNotes).toBe(1);
    expect(harness.repository.batchCalls.factsByNoteIds).toBe(1);
  });

  it('reads the company of every deal in one batch', async () => {
    harness = await createHarness();
    harness.repository.resetCounters();
    const data = await harness.run<{ deals: Array<{ company: { name: string } | null }> }>(
      `{ deals { id company { name } } }`,
    );
    expect(data.deals).toHaveLength(30);
    expect(harness.repository.batchCalls.listDeals).toBe(1);
    expect(harness.repository.batchCalls.companiesByIds).toBe(1);
  });

  it('reads nested contacts and deals in one batch each', async () => {
    harness = await createHarness();
    harness.repository.resetCounters();
    await harness.run(`{ deals { company { name contacts { name } deals { id } } } }`);
    expect(harness.repository.batchCalls.companiesByIds).toBe(1);
    expect(harness.repository.batchCalls.contactsByCompanyIds).toBe(1);
    expect(harness.repository.batchCalls.dealsByCompanyIds).toBe(1);
  });

  it('serves a source sentence without refetching the note per fact', async () => {
    harness = await createHarness();
    harness.repository.resetCounters();
    const data = await harness.run<{ facts: Array<{ sourceSentence: string }> }>(
      `{ facts(noteId: "n01") { sourceSentence } }`,
    );
    expect(data.facts.length).toBeGreaterThan(1);
    expect(harness.repository.batchCalls.notesByIds).toBe(1);
  });

  it('primes the note loader from the list query so no note is read twice', async () => {
    harness = await createHarness();
    harness.repository.resetCounters();
    await harness.run(`{ notes(limit: 50) { id facts { sourceSentence } } }`);
    expect(harness.repository.batchCalls.notesByIds).toBeUndefined();
  });
});
