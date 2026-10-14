import { LLM_SWITCH_ENV, LlmExtractor } from './llm';
import { RuleBasedExtractor } from './rules';
import type { EnvLike, Extractor } from './types';

export * from './grounding';
export * from './llm';
export * from './rules';
export * from './sentences';
export * from './types';
export * from './values';

/**
 * Pick the extractor. The deterministic one is the default; the optional model extractor is
 * only chosen when the switch is set to exactly "on".
 */
export function selectExtractor(env: EnvLike = process.env): Extractor {
  if (env[LLM_SWITCH_ENV] === 'on') return new LlmExtractor(env);
  return new RuleBasedExtractor();
}

export function describeExtractorChoice(env: EnvLike = process.env): string {
  return env[LLM_SWITCH_ENV] === 'on'
    ? 'optional model extractor (switched on by the environment)'
    : 'deterministic rule based extractor (default)';
}
