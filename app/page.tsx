import Link from 'next/link';

import { STAGE_LABELS } from '@/src/ui/highlight';
import { formatDate, sourceLabel } from '@/src/ui/format';
import { query } from '@/src/ui/client';

export const dynamic = 'force-dynamic';

const NOTES_QUERY = /* GraphQL */ `
  query Notes {
    noteCount
    notes(limit: 50) {
      id
      source
      subject
      receivedAt
      ungroundedFactCount
      facts {
        id
        field
        value
      }
      deal {
        stage
        amount {
          formatted
        }
      }
    }
  }
`;

interface NotesData {
  noteCount: number;
  notes: Array<{
    id: string;
    source: string;
    subject: string;
    receivedAt: string;
    ungroundedFactCount: number;
    facts: Array<{ id: string; field: string; value: string }>;
    deal: { stage: string; amount: { formatted: string } | null } | null;
  }>;
}

export default async function NotesPage() {
  const data = await query<NotesData>(NOTES_QUERY);

  return (
    <>
      <p className="notice">
        A prototype and a reliability study, not a production CRM. Every note below is synthetic and
        was written by hand for this repository. Open a note to see each extracted fact beside the
        sentence it came from.
      </p>
      <h2>Notes ({data.noteCount})</h2>
      <ul className="cards">
        {data.notes.map((note) => {
          const company = note.facts.find((fact) => fact.field === 'COMPANY');
          return (
            <li key={note.id} className="card">
              <h3>
                <Link href={`/notes/${note.id}`}>{note.subject}</Link>
              </h3>
              <p className="meta">
                {sourceLabel(note.source)} · {formatDate(note.receivedAt)}
                {company === undefined ? '' : ` · ${company.value}`}
              </p>
              <p className="meta">
                {note.deal === null ? (
                  <span className="pill">no deal</span>
                ) : (
                  <span className="pill">
                    {STAGE_LABELS[note.deal.stage] ?? note.deal.stage}
                    {note.deal.amount === null ? '' : ` · ${note.deal.amount.formatted}`}
                  </span>
                )}{' '}
                <span className="meta">{note.facts.length} facts</span>{' '}
                {note.ungroundedFactCount > 0 ? (
                  <span className="pill warn">{note.ungroundedFactCount} not in the note</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      <footer>Synthetic data. No real people, companies or records.</footer>
    </>
  );
}
