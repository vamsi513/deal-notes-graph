import { describe, expect, it } from 'vitest';

import { describeExtractorChoice, selectExtractor } from '../src/extraction';
import {
  LLM_KEY_ENV,
  LLM_MODEL_ENV,
  LLM_SWITCH_ENV,
  LLM_URL_ENV,
  LlmExtractor,
  LlmExtractorNotConfigured,
  parseFacts,
} from '../src/extraction/llm';
import { RuleBasedExtractor } from '../src/extraction/rules';

const sentences = ['Pinegate Systems is in discovery.', 'We will follow up on Friday.'];

describe('extractor selection', () => {
  it('uses the deterministic extractor with an empty environment', () => {
    expect(selectExtractor({}).name).toBe('rule-based');
    expect(selectExtractor({})).toBeInstanceOf(RuleBasedExtractor);
  });

  it('still uses the deterministic extractor when the switch is off or misspelled', () => {
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'off' }).name).toBe('rule-based');
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'true' }).name).toBe('rule-based');
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'ON' }).name).toBe('rule-based');
  });

  it('selects the optional extractor only for an exact on', () => {
    expect(selectExtractor({ [LLM_SWITCH_ENV]: 'on' }).name).toBe('optional-model');
  });

  it('describes which extractor is in use', () => {
    expect(describeExtractorChoice({})).toContain('deterministic');
    expect(describeExtractorChoice({ [LLM_SWITCH_ENV]: 'on' })).toContain('optional');
  });
});

describe('the optional extractor', () => {
  it('refuses to run with nothing configured, before any network call', async () => {
    const extractor = new LlmExtractor({});
    await expect(extractor.extract({ body: 'anything' })).rejects.toBeInstanceOf(
      LlmExtractorNotConfigured,
    );
  });

  it('names every missing setting', () => {
    const extractor = new LlmExtractor({ [LLM_URL_ENV]: 'https://example.invalid/v1' });
    try {
      extractor.ensureConfigured();
      throw new Error('expected a failure');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(LLM_MODEL_ENV);
      expect(message).toContain(LLM_KEY_ENV);
      expect(message).not.toContain(LLM_URL_ENV);
    }
  });

  it('never puts the credential in the prompt', () => {
    const extractor = new LlmExtractor({
      [LLM_URL_ENV]: 'https://example.invalid/v1',
      [LLM_MODEL_ENV]: 'a-model',
      [LLM_KEY_ENV]: 'secret-value-must-not-leak',
    });
    const prompt = extractor.buildPrompt(sentences);
    expect(prompt).not.toContain('secret-value-must-not-leak');
    expect(prompt).toContain('0. Pinegate Systems is in discovery.');
  });
});

describe('parsing a reply from the optional extractor', () => {
  function reply(content: unknown): unknown {
    return { choices: [{ message: { content } }] };
  }

  it('accepts a well formed fact', () => {
    const facts = parseFacts(
      reply(
        JSON.stringify({
          facts: [
            {
              field: 'STAGE',
              value: 'DISCOVERY',
              sourceSentenceIndex: 0,
              quotedText: 'discovery',
            },
          ],
        }),
      ),
      2,
    );
    expect(facts).toEqual([
      { field: 'STAGE', value: 'DISCOVERY', sourceSentenceIndex: 0, quotedText: 'discovery' },
    ]);
  });

  it('drops a fact with an unknown field', () => {
    const facts = parseFacts(
      reply(
        JSON.stringify({
          facts: [{ field: 'MOOD', value: 'x', sourceSentenceIndex: 0, quotedText: 'y' }],
        }),
      ),
      2,
    );
    expect(facts).toEqual([]);
  });

  it('drops a stage that is not a real stage', () => {
    const facts = parseFacts(
      reply(
        JSON.stringify({
          facts: [{ field: 'STAGE', value: 'MAYBE', sourceSentenceIndex: 0, quotedText: 'x' }],
        }),
      ),
      2,
    );
    expect(facts).toEqual([]);
  });

  it('drops a sentence index outside the note', () => {
    const facts = parseFacts(
      reply(
        JSON.stringify({
          facts: [
            { field: 'COMPANY', value: 'X Labs', sourceSentenceIndex: 7, quotedText: 'X Labs' },
          ],
        }),
      ),
      2,
    );
    expect(facts).toEqual([]);
  });

  it('returns nothing for a malformed or empty reply', () => {
    expect(parseFacts(reply('not json'), 2)).toEqual([]);
    expect(parseFacts({}, 2)).toEqual([]);
    expect(parseFacts(null, 2)).toEqual([]);
    expect(parseFacts(reply(JSON.stringify({ facts: 'nope' })), 2)).toEqual([]);
  });
});
