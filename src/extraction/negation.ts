import { NEGATED_MODALS, NEGATION_TOKENS } from './lexicon';
import { splitClauses } from './sentences';

/**
 * Decide whether a match inside a sentence sits under a negation.
 *
 * Two rules are applied, both scoped to the clause the match falls in. A negated modal such
 * as "will not" negates the whole clause, because it usually sits before the verb the cue is
 * attached to. A plain token such as "no" negates only what comes after it.
 */
export function isNegated(sentence: string, matchIndex: number): boolean {
  const clause = clauseAt(sentence, matchIndex);
  if (clause === null) return false;
  if (NEGATED_MODALS.test(clause.text)) return true;
  const offset = matchIndex - clause.start;
  for (const token of clause.text.matchAll(NEGATION_TOKENS)) {
    if (token.index !== undefined && token.index < offset) return true;
  }
  return false;
}

function clauseAt(sentence: string, matchIndex: number): { text: string; start: number } | null {
  let cursor = 0;
  for (const clause of splitClauses(sentence)) {
    const start = sentence.indexOf(clause, cursor);
    if (start === -1) continue;
    const end = start + clause.length;
    if (matchIndex >= start && matchIndex < end) return { text: clause, start };
    cursor = end;
  }
  return null;
}
