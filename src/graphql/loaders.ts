import DataLoader from 'dataloader';

import type { Company, Contact, Deal, Repository, StoredFact, StoredNote } from '../db/types';

export interface Loaders {
  note: DataLoader<string, StoredNote | null>;
  factsByNote: DataLoader<string, StoredFact[]>;
  company: DataLoader<string, Company | null>;
  contactsByCompany: DataLoader<string, Contact[]>;
  dealsByCompany: DataLoader<string, Deal[]>;
  dealByNote: DataLoader<string, Deal | null>;
}

/**
 * One set of loaders per request. Each loader turns the many lookups a nested query makes into
 * a single batched read, which is what keeps a query such as
 * `deals { company { contacts { ... } } }` off the N plus one path.
 */
export function createLoaders(repository: Repository): Loaders {
  return {
    note: new DataLoader(async (ids) => repository.notesByIds(ids)),
    factsByNote: new DataLoader(async (ids) => repository.factsByNoteIds(ids)),
    company: new DataLoader(async (ids) => repository.companiesByIds(ids)),
    contactsByCompany: new DataLoader(async (ids) => repository.contactsByCompanyIds(ids)),
    dealsByCompany: new DataLoader(async (ids) => repository.dealsByCompanyIds(ids)),
    dealByNote: new DataLoader(async (ids) => repository.dealsByNoteIds(ids)),
  };
}
