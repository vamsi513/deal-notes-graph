import type { DealStage, FactField } from '../extraction/types';
import type { NoteSource } from '../data/datasets';

export interface Company {
  id: string;
  name: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  companyId: string | null;
}

export interface Deal {
  id: string;
  noteId: string;
  companyId: string | null;
  stage: DealStage;
  amountCents: number | null;
  currency: string;
  nextStep: string | null;
}

export interface StoredNote {
  id: string;
  source: NoteSource;
  subject: string;
  receivedAt: string;
  body: string;
  sentences: string[];
}

export interface StoredFact {
  id: string;
  noteId: string;
  field: FactField;
  value: string;
  sourceSentenceIndex: number;
  quotedText: string;
  grounded: boolean;
  groundingReason: string;
}

export interface IngestPayload {
  note: StoredNote;
  facts: StoredFact[];
  company: Company | null;
  contacts: Contact[];
  deal: Deal | null;
}

/**
 * Every read that a resolver can be asked for many times takes a list of ids, so a DataLoader
 * can collapse one request's worth of lookups into a single call.
 */
export interface Repository {
  listNotes(limit: number, offset: number): Promise<StoredNote[]>;
  notesByIds(ids: readonly string[]): Promise<Array<StoredNote | null>>;
  factsByNoteIds(ids: readonly string[]): Promise<StoredFact[][]>;
  companiesByIds(ids: readonly string[]): Promise<Array<Company | null>>;
  contactsByCompanyIds(ids: readonly string[]): Promise<Contact[][]>;
  dealsByCompanyIds(ids: readonly string[]): Promise<Deal[][]>;
  dealsByNoteIds(ids: readonly string[]): Promise<Array<Deal | null>>;
  listDeals(stage: DealStage | null): Promise<Deal[]>;
  countNotes(): Promise<number>;
  ingest(payload: IngestPayload): Promise<void>;
}
