const DECIMAL_MARK = '\u0000';
const ABBREVIATION_MARK = '\u0001';

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATIONS = ['approx', 'e.g', 'i.e', 'no', 'vs', 'etc', 'inc', 'ltd', 'dept', 'est'];

const DECIMAL = /(?<=\d)\.(?=\d)/g;
const BOUNDARY = /(?<=[.!?])\s+/;
const WHITESPACE = /\s+/g;

function protect(text: string): string {
  let out = text.replace(DECIMAL, DECIMAL_MARK);
  for (const abbreviation of ABBREVIATIONS) {
    const pattern = new RegExp(`\\b${abbreviation}\\.`, 'gi');
    out = out.replace(pattern, (match) => match.slice(0, -1) + ABBREVIATION_MARK);
  }
  return out;
}

function restore(text: string): string {
  return text.split(DECIMAL_MARK).join('.').split(ABBREVIATION_MARK).join('.');
}

/**
 * Split a note body into sentences. Decimal amounts such as $12,500.50 and a short list of
 * abbreviations are protected so they do not create a false boundary.
 */
export function splitSentences(text: string): string[] {
  if (text.trim() === '') return [];
  return protect(text)
    .split(BOUNDARY)
    .map((part) => restore(part).replace(WHITESPACE, ' ').trim())
    .filter((part) => part !== '');
}

/** Lowercased, whitespace collapsed form used for every comparison in this project. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(WHITESPACE, ' ').trim();
}

/** Clause boundaries, used to keep a negation from leaking across a sentence. */
export function splitClauses(sentence: string): string[] {
  return sentence
    .split(/[,;:]|\bbut\b|\bhowever\b|\balthough\b|\bso\b/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '');
}
