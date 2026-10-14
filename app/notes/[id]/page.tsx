import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FIELD_LABELS, STAGE_LABELS, groupBySentence, orphanFacts } from '@/src/ui/highlight';
import type { SentenceFact } from '@/src/ui/highlight';
import { formatDate, sourceLabel } from '@/src/ui/format';
import { query } from '@/src/ui/client';
import type { FactField } from '@/src/extraction/types';

export const dynamic = 'force-dynamic';

const NOTE_QUERY = /* GraphQL */ `
  query Note($id: ID!) {
    note(id: $id) {
      id
      source
      subject
      receivedAt
      sentences
      ungroundedFactCount
      facts {
        id
        field
        value
        sourceSentenceIndex
        quotedText
        grounded
        groundingReason
      }
      deal {
        stage
        nextStep
        amount {
          formatted
        }
        company {
          name
          contacts {
            id
            name
            email
          }
        }
      }
    }
  }
`;

interface NoteData {
  note: {
    id: string;
    source: string;
    subject: string;
    receivedAt: string;
    sentences: string[];
    ungroundedFactCount: number;
    facts: SentenceFact[];
    deal: {
      stage: string;
      nextStep: string | null;
      amount: { formatted: string } | null;
      company: {
        name: string;
        contacts: Array<{ id: string; name: string; email: string | null }>;
      } | null;
    } | null;
  } | null;
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await query<NoteData>(NOTE_QUERY, { id });
  const note = data.note;
  if (note === null) notFound();

  const groups = groupBySentence(note.sentences, note.facts);
  const orphans = orphanFacts(note.sentences, note.facts);

  return (
    <>
      <p className="meta">
        <Link href="/">Back to notes</Link>
      </p>
      <h2>{note.subject}</h2>
      <p className="meta">
        {sourceLabel(note.source)} · {formatDate(note.receivedAt)} · {note.facts.length} extracted
        facts
        {note.ungroundedFactCount > 0 ? ` · ${note.ungroundedFactCount} not found in the note` : ''}
      </p>

      {note.deal === null ? null : (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Deal</h3>
          <p className="meta">
            <span className="pill">{STAGE_LABELS[note.deal.stage] ?? note.deal.stage}</span>{' '}
            {note.deal.amount === null ? null : (
              <span className="amount">{note.deal.amount.formatted}</span>
            )}
          </p>
          {note.deal.company === null ? null : (
            <p className="meta">
              {note.deal.company.name}
              {note.deal.company.contacts.length === 0
                ? ''
                : ` · ${note.deal.company.contacts.map((contact) => contact.name).join(', ')}`}
            </p>
          )}
          {note.deal.nextStep === null ? null : (
            <p className="meta">Next step: {note.deal.nextStep}</p>
          )}
        </div>
      )}

      <h3>Facts beside their source</h3>
      <ul className="rows">
        {groups.map((group) => (
          <li key={group.index} className="row">
            <p className="sentence">
              <span className="index" aria-hidden="true">
                {group.index}
              </span>
              <span>
                {group.segments.map((segment, position) =>
                  segment.highlighted ? (
                    <mark key={position}>{segment.text}</mark>
                  ) : (
                    <span key={position}>{segment.text}</span>
                  ),
                )}
              </span>
            </p>
            {group.facts.length === 0 ? (
              <p className="empty">No facts from this sentence.</p>
            ) : (
              <ul className="facts">
                {group.facts.map((fact) => (
                  <li key={fact.id}>
                    <dl className={fact.grounded ? 'fact' : 'fact ungrounded'}>
                      <dt>{FIELD_LABELS[fact.field as FactField] ?? fact.field}</dt>
                      <dd>
                        {fact.value}
                        <div className="quote">
                          {fact.grounded
                            ? `quoted: "${fact.quotedText}"`
                            : `not in the note: ${fact.groundingReason}`}
                        </div>
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {orphans.length === 0 ? null : (
        <>
          <h3>Facts that point outside the note</h3>
          <ul className="facts">
            {orphans.map((fact) => (
              <li key={fact.id}>
                <dl className="fact ungrounded">
                  <dt>{FIELD_LABELS[fact.field as FactField] ?? fact.field}</dt>
                  <dd>
                    {fact.value}
                    <div className="quote">{fact.groundingReason}</div>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
