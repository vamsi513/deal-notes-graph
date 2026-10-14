import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, type Harness } from './helpers';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.stop();
});

describe('Query.notes', () => {
  it('returns the seeded notes with their facts', async () => {
    const data = await harness.run<{
      noteCount: number;
      notes: Array<{ id: string; facts: Array<{ field: string }> }>;
    }>(`{ noteCount notes(limit: 50) { id facts { field } } }`);
    expect(data.noteCount).toBe(30);
    expect(data.notes).toHaveLength(30);
    expect(data.notes[0]?.facts.length).toBeGreaterThan(0);
  });

  it('honours limit and offset', async () => {
    const data = await harness.run<{ notes: Array<{ id: string }> }>(
      `{ notes(limit: 3, offset: 2) { id } }`,
    );
    expect(data.notes).toHaveLength(3);
    expect(data.notes[0]?.id).toBe('n03');
  });

  it('caps an unreasonable limit instead of failing', async () => {
    const data = await harness.run<{ notes: Array<{ id: string }> }>(
      `{ notes(limit: 5000) { id } }`,
    );
    expect(data.notes).toHaveLength(30);
  });
});

describe('Query.note', () => {
  it('returns one note with its sentences and deal', async () => {
    const data = await harness.run<{
      note: { id: string; sentences: string[]; deal: { stage: string } | null };
    }>(`query ($id: ID!) { note(id: $id) { id sentences deal { stage } } }`, { id: 'n01' });
    expect(data.note.id).toBe('n01');
    expect(data.note.sentences).toHaveLength(4);
    expect(data.note.deal?.stage).toBe('DISCOVERY');
  });

  it('returns null for an unknown id', async () => {
    const data = await harness.run<{ note: null }>(`{ note(id: "nope") { id } }`);
    expect(data.note).toBeNull();
  });
});

describe('Query.facts', () => {
  it('returns facts carrying the sentence they came from', async () => {
    const data = await harness.run<{
      facts: Array<{
        field: string;
        value: string;
        sourceSentenceIndex: number;
        sourceSentence: string;
        quotedText: string;
        grounded: boolean;
      }>;
    }>(
      `{ facts(noteId: "n01") { field value sourceSentenceIndex sourceSentence quotedText grounded } }`,
    );
    expect(data.facts.length).toBeGreaterThan(0);
    for (const fact of data.facts) {
      expect(fact.sourceSentence.toLowerCase()).toContain(fact.quotedText.toLowerCase());
      expect(fact.grounded).toBe(true);
    }
  });

  it('returns an empty list for a note with no facts', async () => {
    const data = await harness.run<{ facts: unknown[] }>(`{ facts(noteId: "nope") { field } }`);
    expect(data.facts).toEqual([]);
  });
});

describe('Query.deals', () => {
  it('returns every deal when no stage is given', async () => {
    const data = await harness.run<{ deals: Array<{ id: string }> }>(`{ deals { id } }`);
    expect(data.deals).toHaveLength(30);
  });

  it('filters by stage', async () => {
    const data = await harness.run<{ deals: Array<{ stage: string }> }>(
      `{ deals(stage: CLOSED_WON) { stage } }`,
    );
    expect(data.deals.length).toBeGreaterThan(0);
    for (const deal of data.deals) expect(deal.stage).toBe('CLOSED_WON');
  });

  it('resolves a deal through to its company and contacts', async () => {
    const data = await harness.run<{
      deals: Array<{ company: { name: string; contacts: Array<{ name: string }> } | null }>;
    }>(`{ deals(stage: DISCOVERY) { company { name contacts { name } } } }`);
    const first = data.deals[0];
    expect(first?.company?.name.length).toBeGreaterThan(0);
    expect(first?.company?.contacts.length).toBeGreaterThan(0);
  });

  it('renders an amount in minor units and formatted', async () => {
    const data = await harness.run<{
      note: { deal: { amount: { cents: number; currency: string; formatted: string } | null } };
    }>(`{ note(id: "n01") { deal { amount { cents currency formatted } } } }`);
    expect(data.note.deal.amount).toEqual({
      cents: 3_200_000,
      currency: 'USD',
      formatted: '32000.00 USD',
    });
  });
});

describe('Mutation.ingestNote', () => {
  it('stores a note, extracts facts and makes it queryable', async () => {
    const body =
      'Call with Delphine Aubert at Kestrel Works went well. They are in proposal at $19,000. We will send the quote on Friday.';
    const data = await harness.run<{
      ingestNote: {
        note: { id: string; sentences: string[] };
        facts: Array<{ field: string; value: string; grounded: boolean }>;
        ungroundedCount: number;
        extractionMs: number;
        extractor: string;
      };
    }>(
      `mutation ($input: IngestNoteInput!) {
         ingestNote(input: $input) {
           note { id sentences }
           facts { field value grounded }
           ungroundedCount
           extractionMs
           extractor
         }
       }`,
      { input: { id: 'ingested-1', source: 'EMAIL', subject: 'Kestrel quote', body } },
    );

    expect(data.ingestNote.note.id).toBe('ingested-1');
    expect(data.ingestNote.note.sentences).toHaveLength(3);
    expect(data.ingestNote.extractor).toBe('rule-based');
    expect(data.ingestNote.ungroundedCount).toBe(0);
    expect(data.ingestNote.extractionMs).toBeGreaterThanOrEqual(0);

    const values = Object.fromEntries(
      data.ingestNote.facts.map((fact) => [fact.field, fact.value]),
    );
    expect(values.COMPANY).toBe('Kestrel Works');
    expect(values.CONTACT).toBe('Delphine Aubert');
    expect(values.STAGE).toBe('PROPOSAL');
    expect(values.AMOUNT).toBe('19000.00 USD');

    const check = await harness.run<{ note: { subject: string } }>(
      `{ note(id: "ingested-1") { subject } }`,
    );
    expect(check.note.subject).toBe('Kestrel quote');
  });

  it('generates an id when none is supplied', async () => {
    const data = await harness.run<{ ingestNote: { note: { id: string } } }>(
      `mutation ($input: IngestNoteInput!) { ingestNote(input: $input) { note { id } } }`,
      {
        input: {
          source: 'MEETING',
          subject: 'No id',
          body: 'Pinegate Systems is in discovery. We will follow up.',
        },
      },
    );
    expect(data.ingestNote.note.id).toMatch(/^generated-\d+$/);
  });

  it('records the extraction latency on the metrics registry', async () => {
    const before = harness.metrics.snapshot().extraction.count;
    await harness.run(
      `mutation ($input: IngestNoteInput!) { ingestNote(input: $input) { note { id } } }`,
      {
        input: {
          id: 'ingested-metrics',
          source: 'EMAIL',
          subject: 'Metrics',
          body: 'Marren Robotics is in discovery.',
        },
      },
    );
    expect(harness.metrics.snapshot().extraction.count).toBe(before + 1);
  });

  it('writes one structured log line of counts only, with no note text in it', async () => {
    harness.logs.length = 0;
    const body = 'Oxbow Instruments is in proposal at $5,000.';
    await harness.run(
      `mutation ($input: IngestNoteInput!) { ingestNote(input: $input) { note { id } } }`,
      {
        input: { id: 'ingested-log', source: 'EMAIL', subject: 'Secret subject', body },
      },
    );
    const line = harness.logs.find((record) => record.message === 'note ingested');
    expect(line?.requestId).toBe('test-request');
    expect(line?.factCount).toBeGreaterThan(0);
    expect(line?.sentenceCount).toBe(1);

    // Nothing a caller supplied may appear anywhere in any log line: not the body, not the
    // subject, not the id they chose, and not an extracted value taken from their text.
    const everything = JSON.stringify(harness.logs);
    expect(everything).not.toContain(body);
    expect(everything).not.toContain('Secret subject');
    expect(everything).not.toContain('ingested-log');
    expect(everything).not.toContain('Oxbow Instruments');
  });

  it('rejects an empty body', async () => {
    await expect(
      harness.run(
        `mutation ($input: IngestNoteInput!) { ingestNote(input: $input) { note { id } } }`,
        { input: { source: 'EMAIL', subject: 'Empty', body: '   ' } },
      ),
    ).rejects.toThrow(/needs a body/);
  });
});
