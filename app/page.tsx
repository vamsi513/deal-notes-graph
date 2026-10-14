import Link from 'next/link';

import { FactsBesideSentences } from '@/app/components/FactsBesideSentences';
import { MeasuredResults } from '@/app/components/MeasuredResults';
import { measuredReport } from '@/src/evaluation/cached';
import type { SentenceFact } from '@/src/ui/highlight';
import { formatDate, sourceLabel } from '@/src/ui/format';
import { STAGE_LABELS } from '@/src/ui/highlight';
import { query } from '@/src/ui/client';

export const dynamic = 'force-dynamic';

const DEMO_QUERY = /* GraphQL */ `
  query Demo($id: ID!) {
    notes(limit: 50) {
      id
      subject
    }
    note(id: $id) {
      id
      source
      subject
      receivedAt
      sentences
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
        }
      }
    }
  }
`;

interface DemoData {
  notes: Array<{ id: string; subject: string }>;
  note: {
    id: string;
    source: string;
    subject: string;
    receivedAt: string;
    sentences: string[];
    facts: SentenceFact[];
    deal: {
      stage: string;
      nextStep: string | null;
      amount: { formatted: string } | null;
      company: { name: string } | null;
    } | null;
  } | null;
}

const DEFAULT_NOTE = 'n01';

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const requested = (await searchParams).note;
  const data = await query<DemoData>(DEMO_QUERY, { id: requested ?? DEFAULT_NOTE });
  const note = data.note ?? (await query<DemoData>(DEMO_QUERY, { id: DEFAULT_NOTE })).note;
  const report = await measuredReport();

  return (
    <>
      <p className="notice">
        <strong>A prototype and a reliability study, not a production CRM.</strong> It reads a sales
        note and pulls out five fields, and for every one of them it shows the sentence the value
        was quoted from. Nothing here has touched real customer data. This demo runs with no
        database and no API keys, on 30 synthetic notes written by hand for this repository, using
        the deterministic rule based extractor only.
      </p>

      <section aria-labelledby="pick">
        <h2 id="pick">Pick a note</h2>
        <form method="get" className="picker">
          <label htmlFor="note">Sample note</label>
          <select id="note" name="note" defaultValue={note?.id ?? DEFAULT_NOTE}>
            {data.notes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id} · {option.subject}
              </option>
            ))}
          </select>
          <button type="submit">Show note</button>
        </form>
      </section>

      {note === null ? (
        <p className="empty">That note does not exist.</p>
      ) : (
        <section aria-labelledby="note-heading">
          <h2 id="note-heading">{note.subject}</h2>
          <p className="meta">
            {sourceLabel(note.source)} · {formatDate(note.receivedAt)} · {note.facts.length}{' '}
            extracted facts · <Link href={`/notes/${note.id}`}>open this note on its own page</Link>
          </p>
          {note.deal === null ? null : (
            <p className="meta">
              <span className="pill">{STAGE_LABELS[note.deal.stage] ?? note.deal.stage}</span>{' '}
              {note.deal.amount === null ? null : <strong>{note.deal.amount.formatted}</strong>}{' '}
              {note.deal.company === null ? null : <>· {note.deal.company.name}</>}
            </p>
          )}
          <FactsBesideSentences sentences={note.sentences} facts={note.facts} />
        </section>
      )}

      <section aria-labelledby="measured">
        <h2 id="measured">How often is it right?</h2>
        <p className="meta">
          Scored live, in this process, by the same code that writes the report in the repository.
          30 notes, {report.keyFacts} facts, an answer key written by hand.
        </p>
        <MeasuredResults report={report} compact />
      </section>

      <section aria-labelledby="more">
        <h2 id="more">Look further</h2>
        <ul>
          <li>
            <Link href="/notes">All 30 sample notes</Link>
          </li>
          <li>
            <Link href="/deals">The deals board, one deal per note</Link>
          </li>
          <li>
            <Link href="/playground">The GraphQL schema and a live query panel</Link>
          </li>
          <li>
            <Link href="/results">The full scoring report</Link>
          </li>
        </ul>
      </section>

      <footer>
        Synthetic data. No real people, companies or records. Nothing you submit in the query panel
        is stored.
      </footer>
    </>
  );
}
