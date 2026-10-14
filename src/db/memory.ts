import { loadNotes, type NoteRecord } from '../data/datasets';
import { applyGrounding } from '../extraction/grounding';
import { RuleBasedExtractor } from '../extraction/rules';
import type { DealStage } from '../extraction/types';
import { deriveEntities, toStoredFacts } from './derive';
import type {
  Company,
  Contact,
  Deal,
  IngestPayload,
  Repository,
  StoredFact,
  StoredNote,
} from './types';

/**
 * In memory repository. It is what runs when DATABASE_URL is unset, so the app and the whole
 * test suite work with no database and no network. It also counts how many times each batch
 * read was called, which is how the N plus one test proves the loaders are doing their job.
 */
export class MemoryRepository implements Repository {
  readonly batchCalls: Record<string, number> = {};

  private notes = new Map<string, StoredNote>();
  private facts = new Map<string, StoredFact[]>();
  private companies = new Map<string, Company>();
  private contacts: Contact[] = [];
  private deals = new Map<string, Deal>();

  private count(name: string): void {
    this.batchCalls[name] = (this.batchCalls[name] ?? 0) + 1;
  }

  resetCounters(): void {
    for (const name of Object.keys(this.batchCalls)) delete this.batchCalls[name];
  }

  async listNotes(limit: number, offset: number): Promise<StoredNote[]> {
    this.count('listNotes');
    return [...this.notes.values()]
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id))
      .slice(offset, offset + limit);
  }

  async notesByIds(ids: readonly string[]): Promise<Array<StoredNote | null>> {
    this.count('notesByIds');
    return ids.map((id) => this.notes.get(id) ?? null);
  }

  async factsByNoteIds(ids: readonly string[]): Promise<StoredFact[][]> {
    this.count('factsByNoteIds');
    return ids.map((id) => this.facts.get(id) ?? []);
  }

  async companiesByIds(ids: readonly string[]): Promise<Array<Company | null>> {
    this.count('companiesByIds');
    return ids.map((id) => this.companies.get(id) ?? null);
  }

  async contactsByCompanyIds(ids: readonly string[]): Promise<Contact[][]> {
    this.count('contactsByCompanyIds');
    return ids.map((id) => this.contacts.filter((contact) => contact.companyId === id));
  }

  async dealsByCompanyIds(ids: readonly string[]): Promise<Deal[][]> {
    this.count('dealsByCompanyIds');
    return ids.map((id) => [...this.deals.values()].filter((deal) => deal.companyId === id));
  }

  async dealsByNoteIds(ids: readonly string[]): Promise<Array<Deal | null>> {
    this.count('dealsByNoteIds');
    return ids.map((id) => [...this.deals.values()].find((deal) => deal.noteId === id) ?? null);
  }

  async listDeals(stage: DealStage | null): Promise<Deal[]> {
    this.count('listDeals');
    return [...this.deals.values()]
      .filter((deal) => stage === null || deal.stage === stage)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async countNotes(): Promise<number> {
    this.count('countNotes');
    return this.notes.size;
  }

  async ingest(payload: IngestPayload): Promise<void> {
    this.notes.set(payload.note.id, payload.note);
    this.facts.set(payload.note.id, payload.facts);
    if (payload.company !== null) this.companies.set(payload.company.id, payload.company);
    for (const contact of payload.contacts) {
      if (!this.contacts.some((existing) => existing.id === contact.id)) {
        this.contacts.push(contact);
      }
    }
    if (payload.deal !== null) this.deals.set(payload.deal.id, payload.deal);
  }
}

/** Run the deterministic extractor over a note record and build everything it implies. */
export async function buildIngestPayload(record: NoteRecord): Promise<IngestPayload> {
  const result = await new RuleBasedExtractor().extract({
    subject: record.subject,
    body: record.body,
  });
  const note: StoredNote = {
    id: record.id,
    source: record.source,
    subject: record.subject,
    receivedAt: record.receivedAt,
    body: record.body,
    sentences: result.sentences,
  };
  const facts = toStoredFacts(record.id, applyGrounding(result.facts, result.sentences));
  const { company, contacts, deal } = deriveEntities(note, facts);
  return { note, facts, company, contacts, deal };
}

export async function seedMemoryRepository(
  records: NoteRecord[] = loadNotes(),
): Promise<MemoryRepository> {
  const repository = new MemoryRepository();
  for (const record of records) {
    await repository.ingest(await buildIngestPayload(record));
  }
  repository.resetCounters();
  return repository;
}
