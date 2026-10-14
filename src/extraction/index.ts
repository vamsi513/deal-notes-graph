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
export function selectExtractor(env: EnvLike = process.env, demoMode = false): Extractor {
  // Demo mode refuses the optional extractor outright, so a public deployment can never reach
  // an external endpoint however the environment is configured.
  if (!demoMode && env[LLM_SWITCH_ENV] === 'on') return new LlmExtractor(env);
  return new RuleBasedExtractor();
}

export function describeExtractorChoice(env: EnvLike = process.env, demoMode = false): string {
  if (demoMode) return 'deterministic rule based extractor (demo mode allows no other)';
  return env[LLM_SWITCH_ENV] === 'on'
    ? 'optional model extractor (switched on by the environment)'
    : 'deterministic rule based extractor (default)';
}
