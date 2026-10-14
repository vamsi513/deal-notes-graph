import { STAGE_PATTERNS } from './lexicon';
import type { DealStage } from './types';

const NUMBER = '(?:[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)';

export const CURRENCY_PREFIXED = new RegExp(`\\$\\s?(${NUMBER})\\s?([kKmM])?`, 'g');
export const CURRENCY_SUFFIXED = new RegExp(
  `\\b(${NUMBER})\\s?([kKmM])?\\s?(?:USD|usd|dollars)\\b`,
  'g',
);

export function amountToCents(digits: string, magnitude: string | undefined): number {
  const base = Number.parseFloat(digits.replace(/,/g, ''));
  const scale = magnitude === undefined ? 1 : /[kK]/.test(magnitude) ? 1_000 : 1_000_000;
  return Math.round(base * scale * 100);
}

/** Canonical amount form, so a key entry and an extracted value compare exactly. */
export function formatAmount(cents: number, currency = 'USD'): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function parseAmountCents(text: string): number | null {
  for (const pattern of [CURRENCY_PREFIXED, CURRENCY_SUFFIXED]) {
    for (const match of text.matchAll(pattern)) {
      const digits = match[1];
      if (digits !== undefined) return amountToCents(digits, match[2]);
    }
  }
  return null;
}

/** The stage a span of text names, ignoring negation. Used by the grounding check. */
export function stageFromText(text: string): DealStage | null {
  let best: { position: number; stage: DealStage } | null = null;
  for (const { stage, pattern } of STAGE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      if (best === null || match.index < best.position) best = { position: match.index, stage };
    }
  }
  return best === null ? null : best.stage;
}
