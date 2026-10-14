import { applyGrounding } from '../extraction/grounding';
import type { DealStage } from '../extraction/types';
import { deriveEntities, toStoredFacts } from '../db/derive';
import type { Company, Contact, Deal, StoredFact, StoredNote } from '../db/types';
import { formatAmount } from '../extraction/values';
import type { GraphQLContext } from './context';

interface IngestNoteInput {
  id?: string | null;
  source: 'EMAIL' | 'MEETING';
  subject: string;
  body: string;
  receivedAt?: string | null;
}

const MAX_PAGE = 100;

export const resolvers = {
  Query: {
    notes: async (
      _parent: unknown,
      args: { limit?: number | null; offset?: number | null },
      context: GraphQLContext,
    ): Promise<StoredNote[]> => {
      context.metrics.recordOperation('notes');
      const limit = Math.min(Math.max(args.limit ?? 30, 1), MAX_PAGE);
      const offset = Math.max(args.offset ?? 0, 0);
      const notes = await context.repository.listNotes(limit, offset);
      for (const note of notes) context.loaders.note.prime(note.id, note);
      return notes;
    },

    note: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ): Promise<StoredNote | null> => {
      context.metrics.recordOperation('note');
      return context.loaders.note.load(args.id);
    },

    facts: async (
      _parent: unknown,
      args: { noteId: string },
      context: GraphQLContext,
    ): Promise<StoredFact[]> => {
      context.metrics.recordOperation('facts');
      return context.loaders.factsByNote.load(args.noteId);
    },

    deals: async (
      _parent: unknown,
      args: { stage?: DealStage | null },
      context: GraphQLContext,
    ): Promise<Deal[]> => {
      context.metrics.recordOperation('deals');
      return context.repository.listDeals(args.stage ?? null);
    },

    noteCount: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ): Promise<number> => {
      context.metrics.recordOperation('noteCount');
      return context.repository.countNotes();
    },
  },

  Mutation: {
    ingestNote: async (
      _parent: unknown,
      args: { input: IngestNoteInput },
      context: GraphQLContext,
    ) => {
      context.metrics.recordOperation('ingestNote');
      const { input } = args;
      if (input.body.trim() === '') throw new Error('a note needs a body');
      const id = input.id ?? context.newNoteId();

      const startedAt = performance.now();
      const extraction = await context.extractor.extract({
        subject: input.subject,
        body: input.body,
      });
      const extractionMs = performance.now() - startedAt;
      context.metrics.recordExtraction(extractionMs);

      const note: StoredNote = {
        id,
        source: input.source,
        subject: input.subject,
        receivedAt: input.receivedAt ?? new Date().toISOString(),
        body: input.body,
        sentences: extraction.sentences,
      };
      const facts = toStoredFacts(id, applyGrounding(extraction.facts, extraction.sentences));
      const derived = deriveEntities(note, facts);
      if (context.persistIngestedNotes) {
        await context.repository.ingest({ note, facts, ...derived });
        context.loaders.note.clear(id).prime(id, note);
        context.loaders.factsByNote.clear(id).prime(id, facts);
        context.loaders.dealByNote.clear(id);
      } else {
        // Demo mode. The result is returned to the caller and then dropped: nothing a visitor
        // submits reaches the store, the note list or another visitor.
        context.loaders.note.prime(id, note);
        context.loaders.factsByNote.prime(id, facts);
      }

      const ungroundedCount = facts.filter((fact) => !fact.grounded).length;
      // Counts only. No note text, no subject, no extracted value is ever written to a log.
      context.logger.info('note ingested', {
        stored: context.persistIngestedNotes,
        extractor: extraction.extractorName,
        sentenceCount: extraction.sentences.length,
        factCount: facts.length,
        ungroundedCount,
        extractionMs: Math.round(extractionMs * 1000) / 1000,
      });

      return {
        note,
        facts,
        ungroundedCount,
        extractionMs,
        extractor: extraction.extractorName,
      };
    },
  },

  Note: {
    facts: async (note: StoredNote, _args: unknown, context: GraphQLContext) =>
      context.loaders.factsByNote.load(note.id),
    deal: async (note: StoredNote, _args: unknown, context: GraphQLContext) =>
      context.loaders.dealByNote.load(note.id),
    ungroundedFactCount: async (note: StoredNote, _args: unknown, context: GraphQLContext) => {
      const facts = await context.loaders.factsByNote.load(note.id);
      return facts.filter((fact) => !fact.grounded).length;
    },
  },

  Fact: {
    sourceSentence: async (fact: StoredFact, _args: unknown, context: GraphQLContext) => {
      const note = await context.loaders.note.load(fact.noteId);
      return note?.sentences[fact.sourceSentenceIndex] ?? '';
    },
  },

  Deal: {
    amount: (deal: Deal) =>
      deal.amountCents === null
        ? null
        : {
            cents: deal.amountCents,
            currency: deal.currency,
            formatted: formatAmount(deal.amountCents, deal.currency),
          },
    company: async (deal: Deal, _args: unknown, context: GraphQLContext) =>
      deal.companyId === null ? null : context.loaders.company.load(deal.companyId),
    note: async (deal: Deal, _args: unknown, context: GraphQLContext) =>
      context.loaders.note.load(deal.noteId),
  },

  Company: {
    contacts: async (company: Company, _args: unknown, context: GraphQLContext) =>
      context.loaders.contactsByCompany.load(company.id),
    deals: async (company: Company, _args: unknown, context: GraphQLContext) =>
      context.loaders.dealsByCompany.load(company.id),
  },

  Contact: {
    company: async (contact: Contact, _args: unknown, context: GraphQLContext) =>
      contact.companyId === null ? null : context.loaders.company.load(contact.companyId),
  },
};
