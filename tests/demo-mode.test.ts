import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEMO_MODE_ENV, describeMode, isDemoMode, persistsIngestedNotes } from '../src/config';
import { describeExtractorChoice, selectExtractor } from '../src/extraction';
import { LLM_SWITCH_ENV } from '../src/extraction/llm';
import { createHarness, type Harness } from './helpers';

describe('demo mode selection', () => {
  it('is on when nothing is configured, which is what a public deploy runs', () => {
    expect(isDemoMode({})).toBe(true);
  });

  it('is off once a database is configured', () => {
    expect(isDemoMode({ DATABASE_URL: 'postgres://localhost/x' })).toBe(false);
  });

  it('can be forced on even with a database', () => {
    expect(isDemoMode({ DATABASE_URL: 'postgres://localhost/x', [DEMO_MODE_ENV]: 'on' })).toBe(
      true,
    );
  });

  it('can be forced off', () => {
    expect(isDemoMode({ [DEMO_MODE_ENV]: 'off' })).toBe(false);
  });

  it('never persists what a visitor submits while it is on', () => {
    expect(persistsIngestedNotes({})).toBe(false);
    expect(persistsIngestedNotes({ DATABASE_URL: 'postgres://localhost/x' })).toBe(true);
  });

  it('says which mode it is in', () => {
    expect(describeMode({})).toContain('demo mode');
    expect(describeMode({ DATABASE_URL: 'postgres://localhost/x' })).toContain('full mode');
  });
});

describe('demo mode and the optional extractor', () => {
  it('refuses the optional extractor even when the switch is on', () => {
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'on' }, true).name).toBe('rule-based');
  });

  it('still honours the switch outside demo mode', () => {
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'on' }, false).name).toBe('optional-model');
  });

  it('says the deterministic extractor is the only one available', () => {
    expect(describeExtractorChoice({ [LLM_SWITCH_ENV]: 'on' }, true)).toContain('no other');
  });
});

describe('ingest in demo mode', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await createHarness({ persistIngestedNotes: false });
  });

  afterAll(async () => {
    await harness.stop();
  });

  const MUTATION = `mutation ($input: IngestNoteInput!) {
    ingestNote(input: $input) {
      note { id }
      facts { field value }
      extractor
    }
  }`;

  it('still extracts and returns facts', async () => {
    const data = await harness.run<{
      ingestNote: { facts: Array<{ field: string; value: string }>; extractor: string };
    }>(MUTATION, {
      input: {
        id: 'visitor-note',
        source: 'EMAIL',
        subject: 'From a visitor',
        body: 'Call with Petra Walsh at Kestrel Works went well. They are in negotiation at $44,000.',
      },
    });
    const values = Object.fromEntries(
      data.ingestNote.facts.map((fact) => [fact.field, fact.value]),
    );
    expect(values.COMPANY).toBe('Kestrel Works');
    expect(values.AMOUNT).toBe('44000.00 USD');
    expect(data.ingestNote.extractor).toBe('rule-based');
  });

  it('stores nothing, so the note is not queryable afterwards', async () => {
    const data = await harness.run<{ note: null }>(`{ note(id: "visitor-note") { id } }`);
    expect(data.note).toBeNull();
  });

  it('leaves the note count and the deal board untouched', async () => {
    const data = await harness.run<{ noteCount: number; deals: Array<{ id: string }> }>(
      `{ noteCount deals { id } }`,
    );
    expect(data.noteCount).toBe(30);
    expect(data.deals).toHaveLength(30);
  });

  it('writes no visitor text to any log line', async () => {
    harness.logs.length = 0;
    const body = 'Verdant Mills signed the contract for $77,000 this morning.';
    await harness.run(MUTATION, {
      input: { id: 'private-id', source: 'EMAIL', subject: 'Private subject', body },
    });
    const everything = JSON.stringify(harness.logs);
    expect(harness.logs.length).toBeGreaterThan(0);
    for (const forbidden of [body, 'Private subject', 'private-id', 'Verdant Mills', '77,000']) {
      expect(everything, forbidden).not.toContain(forbidden);
    }
  });
});
