import { splitSentences } from './sentences';
import type { EnvLike, ExtractedFact, ExtractionInput, ExtractionResult, Extractor } from './types';
import { isDealStage, isFactField } from './types';

export const LLM_SWITCH_ENV = 'DEAL_NOTES_LLM_EXTRACTOR';
export const LLM_URL_ENV = 'DEAL_NOTES_LLM_URL';
export const LLM_MODEL_ENV = 'DEAL_NOTES_LLM_MODEL';
export const LLM_KEY_ENV = 'DEAL_NOTES_LLM_API_KEY';

export class LlmExtractorNotConfigured extends Error {
  constructor(missing: string[]) {
    super(`the optional extractor is not configured; set ${missing.join(', ')} to enable it`);
    this.name = 'LlmExtractorNotConfigured';
  }
}

/**
 * Optional extractor that asks a chat completion endpoint for the same fact shape.
 *
 * It is off unless DEAL_NOTES_LLM_EXTRACTOR is exactly "on", it is never selected by the
 * tests, by continuous integration or by the measured evaluation, and it throws before
 * opening a socket when any setting is missing. Configuration comes from the environment so
 * no credential is written into this repository, and the value is never logged or returned.
 */
export class LlmExtractor implements Extractor {
  readonly name = 'optional-model';

  private readonly url: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(env: EnvLike = process.env, timeoutMs = 30_000) {
    this.url = env[LLM_URL_ENV] ?? '';
    this.model = env[LLM_MODEL_ENV] ?? '';
    this.apiKey = env[LLM_KEY_ENV] ?? '';
    this.timeoutMs = timeoutMs;
  }

  ensureConfigured(): void {
    const missing = [
      [LLM_URL_ENV, this.url],
      [LLM_MODEL_ENV, this.model],
      [LLM_KEY_ENV, this.apiKey],
    ]
      .filter(([, value]) => value === '')
      .map(([name]) => name as string);
    if (missing.length > 0) throw new LlmExtractorNotConfigured(missing);
  }

  buildPrompt(sentences: string[]): string {
    const numbered = sentences.map((sentence, index) => `${index}. ${sentence}`).join('\n');
    return [
      'Read the numbered sentences from one sales note.',
      'Return JSON: {"facts":[{"field":"CONTACT|COMPANY|STAGE|AMOUNT|NEXT_STEP",',
      '"value":"...","sourceSentenceIndex":0,"quotedText":"verbatim span"}]}.',
      'Quote the span verbatim from the sentence you cite. Do not invent a value.',
      '',
      numbered,
    ].join('\n');
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    this.ensureConfigured();
    const sentences = splitSentences(input.body);
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: this.buildPrompt(sentences) }],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`the optional extractor endpoint returned ${response.status}`);
    }
    const body: unknown = await response.json();
    return { extractorName: this.name, sentences, facts: parseFacts(body, sentences.length) };
  }
}

/** Keep anything malformed out of the fact list rather than trusting the reply. */
export function parseFacts(body: unknown, sentenceCount: number): ExtractedFact[] {
  const content = readContent(body);
  if (content === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const raw = (parsed as { facts?: unknown }).facts;
  if (!Array.isArray(raw)) return [];
  const facts: ExtractedFact[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const candidate = item as Record<string, unknown>;
    const field = candidate.field;
    const value = candidate.value;
    const index = candidate.sourceSentenceIndex;
    const quotedText = candidate.quotedText;
    if (typeof field !== 'string' || !isFactField(field)) continue;
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (typeof index !== 'number' || !Number.isInteger(index)) continue;
    if (index < 0 || index >= sentenceCount) continue;
    if (typeof quotedText !== 'string' || quotedText.trim() === '') continue;
    if (field === 'STAGE' && !isDealStage(value)) continue;
    facts.push({ field, value, sourceSentenceIndex: index, quotedText });
  }
  return facts;
}

function readContent(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== 'object' || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}
