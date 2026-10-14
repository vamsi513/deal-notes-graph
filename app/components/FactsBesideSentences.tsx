import { FIELD_LABELS, groupBySentence, orphanFacts } from '@/src/ui/highlight';
import type { SentenceFact } from '@/src/ui/highlight';
import type { FactField } from '@/src/extraction/types';

/**
 * The heart of the interface: every sentence of the note, with the facts read from it beside
 * it and the quoted span highlighted inside it. A fact whose quote is not in the note is shown
 * in the same place, flagged, rather than hidden.
 */
export function FactsBesideSentences({
  sentences,
  facts,
}: {
  sentences: string[];
  facts: SentenceFact[];
}) {
  const groups = groupBySentence(sentences, facts);
  const orphans = orphanFacts(sentences, facts);

  return (
    <>
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
