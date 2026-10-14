import type { EnvLike } from './extraction/types';

export const DEMO_MODE_ENV = 'DEAL_NOTES_DEMO_MODE';

/**
 * Demo mode is what the public deployment runs.
 *
 * It is on whenever there is no database configured, and can be forced on with
 * DEAL_NOTES_DEMO_MODE=on. In demo mode the app reads the 30 sample notes and the answer key
 * from files in this repository, the deterministic extractor is the only one that can run, and
 * nothing a visitor submits is stored.
 */
export function isDemoMode(env: EnvLike = process.env): boolean {
  if (env[DEMO_MODE_ENV] === 'on') return true;
  if (env[DEMO_MODE_ENV] === 'off') return false;
  return (env.DATABASE_URL ?? '') === '';
}

/** Demo mode never persists what a visitor submits. */
export function persistsIngestedNotes(env: EnvLike = process.env): boolean {
  return !isDemoMode(env);
}

export function describeMode(env: EnvLike = process.env): string {
  return isDemoMode(env)
    ? 'demo mode: sample notes from this repository, deterministic extractor, nothing stored'
    : 'full mode: postgresql, nothing forced';
}
