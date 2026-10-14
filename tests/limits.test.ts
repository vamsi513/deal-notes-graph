import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MAX_BODY_BYTES,
  MAX_QUERY_DEPTH,
  MAX_SELECTIONS,
  declaredLengthWithinLimit,
  measureBody,
} from '../src/graphql/limits';
import { createHarness, type Harness } from './helpers';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.stop();
});

/** Run an operation and return the error messages rather than throwing. */
async function errorsFor(query: string): Promise<string> {
  try {
    await harness.run(query);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function nest(levels: number): string {
  let inner = 'name';
  for (let depth = 0; depth < levels; depth += 1) {
    inner = `company { ${inner} }`;
  }
  return `{ deals { ${inner} } }`;
}

describe('query depth limit', () => {
  it('allows a query within the limit', async () => {
    expect(await errorsFor(`{ deals { company { contacts { name } } } }`)).toBe('');
  });

  it('refuses a query nested past the limit', async () => {
    const message = await errorsFor(nest(MAX_QUERY_DEPTH + 2));
    expect(message).toContain('levels deep');
    expect(message).toContain(`limit is ${MAX_QUERY_DEPTH}`);
  });

  it('counts depth through a fragment rather than being fooled by one', async () => {
    const query = `
      { deals { ...deep } }
      fragment deep on Deal {
        company { deals { company { deals { company { deals { company { name } } } } } } }
      }
    `;
    expect(await errorsFor(query)).toContain('levels deep');
  });

  it('reports the depth it measured', async () => {
    expect(await errorsFor(nest(MAX_QUERY_DEPTH + 1))).toMatch(/query is \d+ levels deep/);
  });
});

describe('selection limit', () => {
  it('refuses a query that selects an unreasonable number of fields', async () => {
    const fields = Array.from({ length: MAX_SELECTIONS + 10 }, (_, index) => `f${index}: id`).join(
      ' ',
    );
    expect(await errorsFor(`{ notes { ${fields} } }`)).toContain('more than');
  });

  it('allows an ordinary query well under the limit', async () => {
    expect(await errorsFor(`{ notes(limit: 5) { id subject receivedAt } }`)).toBe('');
  });
});

describe('request body cap', () => {
  it('accepts a body inside the cap', () => {
    expect(measureBody('{"query":"{ noteCount }"}').withinLimit).toBe(true);
  });

  it('refuses a body over the cap', () => {
    const oversized = 'x'.repeat(MAX_BODY_BYTES + 1);
    const measured = measureBody(oversized);
    expect(measured.withinLimit).toBe(false);
    expect(measured.bytes).toBe(MAX_BODY_BYTES + 1);
  });

  it('measures bytes rather than characters', () => {
    const multiByte = 'é'.repeat(MAX_BODY_BYTES - 1);
    expect(multiByte.length).toBeLessThan(MAX_BODY_BYTES);
    expect(measureBody(multiByte).withinLimit).toBe(false);
  });

  it('refuses a declared content length over the cap', () => {
    expect(declaredLengthWithinLimit(String(MAX_BODY_BYTES + 1))).toBe(false);
    expect(declaredLengthWithinLimit(String(MAX_BODY_BYTES))).toBe(true);
  });

  it('does not refuse a request with no or an unreadable content length', () => {
    expect(declaredLengthWithinLimit(null)).toBe(true);
    expect(declaredLengthWithinLimit('')).toBe(true);
    expect(declaredLengthWithinLimit('not a number')).toBe(true);
  });
});
