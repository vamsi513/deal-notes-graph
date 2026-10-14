import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool, type PoolClient } from 'pg';

import type { NoteSource } from '../data/datasets';
import type { DealStage, FactField } from '../extraction/types';
import type {
  Company,
  Contact,
  Deal,
  IngestPayload,
  Repository,
  StoredFact,
  StoredNote,
} from './types';

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = join(here, 'schema.sql');

interface NoteRow {
  id: string;
  source: string;
  subject: string;
  received_at: Date;
  body: string;
  sentences: unknown;
}

interface FactRow {
  id: string;
  note_id: string;
  field: string;
  value: string;
  source_sentence_index: number;
  quoted_text: string;
  grounded: boolean;
  grounding_reason: string;
}

interface DealRow {
  id: string;
  note_id: string;
  company_id: string | null;
  stage: string;
  amount_cents: string | number | null;
  currency: string;
  next_step: string | null;
}

/**
 * PostgreSQL repository. Every read takes an array of ids and uses `= ANY($1)` so that one
 * DataLoader batch is one round trip, which is what keeps the resolvers off the N plus one
 * path when a query walks notes to facts or companies to deals.
 */
export class PostgresRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  static fromUrl(connectionString: string): PostgresRepository {
    return new PostgresRepository(new Pool({ connectionString }));
  }

  async migrate(): Promise<void> {
    await this.pool.query(readFileSync(SCHEMA_PATH, 'utf8'));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async listNotes(limit: number, offset: number): Promise<StoredNote[]> {
    const { rows } = await this.pool.query<NoteRow>(
      'SELECT * FROM notes ORDER BY received_at, id LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return rows.map(toNote);
  }

  async notesByIds(ids: readonly string[]): Promise<Array<StoredNote | null>> {
    const { rows } = await this.pool.query<NoteRow>('SELECT * FROM notes WHERE id = ANY($1)', [
      [...ids],
    ]);
    const byId = new Map(rows.map((row) => [row.id, toNote(row)]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  async factsByNoteIds(ids: readonly string[]): Promise<StoredFact[][]> {
    const { rows } = await this.pool.query<FactRow>(
      'SELECT * FROM facts WHERE note_id = ANY($1) ORDER BY source_sentence_index, field',
      [[...ids]],
    );
    const grouped = new Map<string, StoredFact[]>();
    for (const row of rows) {
      const list = grouped.get(row.note_id) ?? [];
      list.push(toFact(row));
      grouped.set(row.note_id, list);
    }
    return ids.map((id) => grouped.get(id) ?? []);
  }

  async companiesByIds(ids: readonly string[]): Promise<Array<Company | null>> {
    const { rows } = await this.pool.query<Company>(
      'SELECT id, name FROM companies WHERE id = ANY($1)',
      [[...ids]],
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  async contactsByCompanyIds(ids: readonly string[]): Promise<Contact[][]> {
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      email: string | null;
      company_id: string | null;
    }>('SELECT * FROM contacts WHERE company_id = ANY($1) ORDER BY name', [[...ids]]);
    const grouped = new Map<string, Contact[]>();
    for (const row of rows) {
      const key = row.company_id ?? '';
      const list = grouped.get(key) ?? [];
      list.push({ id: row.id, name: row.name, email: row.email, companyId: row.company_id });
      grouped.set(key, list);
    }
    return ids.map((id) => grouped.get(id) ?? []);
  }

  async dealsByCompanyIds(ids: readonly string[]): Promise<Deal[][]> {
    const { rows } = await this.pool.query<DealRow>(
      'SELECT * FROM deals WHERE company_id = ANY($1) ORDER BY id',
      [[...ids]],
    );
    const grouped = new Map<string, Deal[]>();
    for (const row of rows) {
      const key = row.company_id ?? '';
      const list = grouped.get(key) ?? [];
      list.push(toDeal(row));
      grouped.set(key, list);
    }
    return ids.map((id) => grouped.get(id) ?? []);
  }

  async dealsByNoteIds(ids: readonly string[]): Promise<Array<Deal | null>> {
    const { rows } = await this.pool.query<DealRow>('SELECT * FROM deals WHERE note_id = ANY($1)', [
      [...ids],
    ]);
    const byNote = new Map(rows.map((row) => [row.note_id, toDeal(row)]));
    return ids.map((id) => byNote.get(id) ?? null);
  }

  async listDeals(stage: DealStage | null): Promise<Deal[]> {
    const { rows } =
      stage === null
        ? await this.pool.query<DealRow>('SELECT * FROM deals ORDER BY id')
        : await this.pool.query<DealRow>('SELECT * FROM deals WHERE stage = $1 ORDER BY id', [
            stage,
          ]);
    return rows.map(toDeal);
  }

  async countNotes(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text FROM notes');
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  }

  async ingest(payload: IngestPayload): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await writeIngest(client, payload);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function writeIngest(client: PoolClient, payload: IngestPayload): Promise<void> {
  const { note, facts, company, contacts, deal } = payload;
  if (company !== null) {
    await client.query(
      'INSERT INTO companies (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
      [company.id, company.name],
    );
  }
  await client.query(
    `INSERT INTO notes (id, source, subject, received_at, body, sentences)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body,
       sentences = EXCLUDED.sentences`,
    [note.id, note.source, note.subject, note.receivedAt, note.body, JSON.stringify(note.sentences)],
  );
  for (const contact of contacts) {
    await client.query(
      `INSERT INTO contacts (id, name, email, company_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, contacts.email),
         company_id = COALESCE(EXCLUDED.company_id, contacts.company_id)`,
      [contact.id, contact.name, contact.email, contact.companyId],
    );
  }
  await client.query('DELETE FROM facts WHERE note_id = $1', [note.id]);
  for (const fact of facts) {
    await client.query(
      `INSERT INTO facts
         (id, note_id, field, value, source_sentence_index, quoted_text, grounded, grounding_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        fact.id,
        fact.noteId,
        fact.field,
        fact.value,
        fact.sourceSentenceIndex,
        fact.quotedText,
        fact.grounded,
        fact.groundingReason,
      ],
    );
  }
  if (deal !== null) {
    await client.query(
      `INSERT INTO deals (id, note_id, company_id, stage, amount_cents, currency, next_step)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET stage = EXCLUDED.stage, amount_cents = EXCLUDED.amount_cents,
         next_step = EXCLUDED.next_step, company_id = EXCLUDED.company_id`,
      [
        deal.id,
        deal.noteId,
        deal.companyId,
        deal.stage,
        deal.amountCents,
        deal.currency,
        deal.nextStep,
      ],
    );
  }
}

function toNote(row: NoteRow): StoredNote {
  return {
    id: row.id,
    source: row.source as NoteSource,
    subject: row.subject,
    receivedAt: new Date(row.received_at).toISOString(),
    body: row.body,
    sentences: Array.isArray(row.sentences) ? (row.sentences as string[]) : [],
  };
}

function toFact(row: FactRow): StoredFact {
  return {
    id: row.id,
    noteId: row.note_id,
    field: row.field as FactField,
    value: row.value,
    sourceSentenceIndex: row.source_sentence_index,
    quotedText: row.quoted_text,
    grounded: row.grounded,
    groundingReason: row.grounding_reason,
  };
}

function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    noteId: row.note_id,
    companyId: row.company_id,
    stage: row.stage as DealStage,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    currency: row.currency,
    nextStep: row.next_step,
  };
}
