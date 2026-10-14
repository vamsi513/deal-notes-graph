import Link from 'next/link';

import { STAGE_LABELS } from '@/src/ui/highlight';
import { DEAL_STAGES } from '@/src/extraction/types';
import { query } from '@/src/ui/client';

export const dynamic = 'force-dynamic';

const DEALS_QUERY = /* GraphQL */ `
  query Deals {
    deals {
      id
      stage
      nextStep
      amount {
        formatted
      }
      company {
        name
      }
      note {
        id
        subject
      }
    }
  }
`;

interface DealsData {
  deals: Array<{
    id: string;
    stage: string;
    nextStep: string | null;
    amount: { formatted: string } | null;
    company: { name: string } | null;
    note: { id: string; subject: string } | null;
  }>;
}

export default async function DealsPage() {
  const data = await query<DealsData>(DEALS_QUERY);

  return (
    <>
      <p className="notice">
        One deal per note, derived from the grounded facts of that note. A prototype view, not a
        pipeline you should plan against.
      </p>
      <h2>Deals by stage ({data.deals.length})</h2>
      <div className="board">
        {DEAL_STAGES.map((stage) => {
          const deals = data.deals.filter((deal) => deal.stage === stage);
          return (
            <section key={stage} className="column" aria-labelledby={`stage-${stage}`}>
              <h2 id={`stage-${stage}`}>
                <span>{STAGE_LABELS[stage] ?? stage}</span>
                <span className="count">{deals.length}</span>
              </h2>
              {deals.length === 0 ? (
                <p className="empty">Nothing here.</p>
              ) : (
                deals.map((deal) => (
                  <article key={deal.id} className="deal">
                    <div className="amount">{deal.amount?.formatted ?? 'no amount'}</div>
                    <p>{deal.company?.name ?? 'no company'}</p>
                    {deal.note === null ? null : (
                      <p>
                        <Link href={`/notes/${deal.note.id}`}>{deal.note.subject}</Link>
                      </p>
                    )}
                    {deal.nextStep === null ? null : <p>Next: {deal.nextStep}</p>}
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
