export const DEAL_STAGES = [
  'PROSPECT',
  'DISCOVERY',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const FACT_FIELDS = ['CONTACT', 'COMPANY', 'STAGE', 'AMOUNT', 'NEXT_STEP'] as const;

export type FactField = (typeof FACT_FIELDS)[number];

export function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value);
}

export function isFactField(value: string): value is FactField {
  return (FACT_FIELDS as readonly string[]).includes(value);
}

/** One fact pulled out of a note, always carrying where it came from. */
export interface ExtractedFact {
  field: FactField;
  /** Canonical value. Amounts are "<units>.<cents> <currency>", stages are the enum name. */
  value: string;
  /** Zero based index into the note's sentences. */
  sourceSentenceIndex: number;
  /** The span of the source sentence the value was read from, quoted verbatim. */
  quotedText: string;
}

export interface ExtractionInput {
  subject?: string;
  body: string;
}

export interface ExtractionResult {
  extractorName: string;
  sentences: string[];
  facts: ExtractedFact[];
}

/**
 * The pluggable extractor interface. The rule based extractor is the default and is the only
 * one used by the tests, by continuous integration and by the measured evaluation.
 */
export interface Extractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
