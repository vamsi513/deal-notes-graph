import type { GroundedFact } from '../extraction/grounding';
import type { DealStage } from '../extraction/types';
import { parseAmountCents } from '../extraction/values';
import type { Company, Contact, Deal, StoredFact, StoredNote } from './types';

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toStoredFacts(noteId: string, facts: GroundedFact[]): StoredFact[] {
  return facts.map((fact, position) => ({
    id: `${noteId}-f${String(position + 1).padStart(2, '0')}`,
    noteId,
    field: fact.field,
    value: fact.value,
    sourceSentenceIndex: fact.sourceSentenceIndex,
    quotedText: fact.quotedText,
    grounded: fact.grounded,
    groundingReason: fact.groundingReason,
  }));
}

/**
 * Turn the facts of one note into the CRM rows they imply. Only grounded facts are promoted,
 * so a fact the grounding check rejected is still visible in the UI but never becomes a deal.
 */
export function deriveEntities(
  note: StoredNote,
  facts: StoredFact[],
): { company: Company | null; contacts: Contact[]; deal: Deal | null } {
  const usable = facts.filter((fact) => fact.grounded);
  const companyFact = usable.find((fact) => fact.field === 'COMPANY');
  const company: Company | null =
    companyFact === undefined ? null : { id: slug(companyFact.value), name: companyFact.value };

  const contacts: Contact[] = usable
    .filter((fact) => fact.field === 'CONTACT')
    .map((fact) => ({
      id: slug(fact.value),
      name: fact.value,
      email: emailFrom(fact.quotedText),
      companyId: company?.id ?? null,
    }));

  const stageFact = usable.find((fact) => fact.field === 'STAGE');
  const amountFact = usable.find((fact) => fact.field === 'AMOUNT');
  const nextStepFact = usable.find((fact) => fact.field === 'NEXT_STEP');

  const deal: Deal | null =
    stageFact === undefined && amountFact === undefined
      ? null
      : {
          id: `deal-${note.id}`,
          noteId: note.id,
          companyId: company?.id ?? null,
          stage: (stageFact?.value ?? 'PROSPECT') as DealStage,
          amountCents: amountFact === undefined ? null : parseAmountCents(amountFact.quotedText),
          currency: 'USD',
          nextStep: nextStepFact?.value ?? null,
        };

  return { company, contacts, deal };
}

function emailFrom(text: string): string | null {
  return /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(text)?.[0] ?? null;
}
