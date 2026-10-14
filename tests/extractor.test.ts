import { beforeEach, describe, expect, it } from 'vitest';

import { RuleBasedExtractor } from '../src/extraction/rules';
import type { ExtractedFact, FactField } from '../src/extraction/types';

const extractor = new RuleBasedExtractor();

async function factsFor(body: string): Promise<ExtractedFact[]> {
  return (await extractor.extract({ body })).facts;
}

async function valuesFor(body: string, field: FactField): Promise<string[]> {
  return (await factsFor(body)).filter((fact) => fact.field === field).map((fact) => fact.value);
}

async function one(body: string, field: FactField): Promise<ExtractedFact | undefined> {
  return (await factsFor(body)).find((fact) => fact.field === field);
}

describe('contact rule', () => {
  it('reads a name introduced by a cue word', async () => {
    expect(await valuesFor('Call with Imani Dorsey went well.', 'CONTACT')).toEqual([
      'Imani Dorsey',
    ]);
  });

  it('reads a name followed by a cue word', async () => {
    expect(await valuesFor('Teodor Vance confirmed the budget.', 'CONTACT')).toEqual([
      'Teodor Vance',
    ]);
  });

  it('reads two contacts from one sentence', async () => {
    expect(
      await valuesFor(
        'Met with Caleb Renner and Soraya Lind from Brightwater Analytics.',
        'CONTACT',
      ),
    ).toEqual(['Caleb Renner', 'Soraya Lind']);
  });

  it('does not read a company name as a person', async () => {
    expect(await valuesFor('Harbor Lane Logistics replied today.', 'CONTACT')).toEqual([]);
  });

  it('derives a name from a work email address', async () => {
    const facts = await valuesFor('Cc petra.walsh@harbor-lane.example on the thread.', 'CONTACT');
    expect(facts).toEqual(['Petra Walsh']);
  });

  it('does not repeat a contact mentioned twice', async () => {
    expect(
      await valuesFor('Met with Tobias Kerr today. Tobias Kerr owns the budget.', 'CONTACT'),
    ).toEqual(['Tobias Kerr']);
  });
});

describe('company rule', () => {
  it('reads a name that ends in a company suffix', async () => {
    expect(await valuesFor('We spoke to Pinegate Systems about the pilot.', 'COMPANY')).toEqual([
      'Pinegate Systems',
    ]);
  });

  it('reads a multi word company name', async () => {
    expect(await valuesFor('Tallow Creek Foods asked for a quote.', 'COMPANY')).toEqual([
      'Tallow Creek Foods',
    ]);
  });

  it('finds no company when no name carries a suffix', async () => {
    expect(await valuesFor('They asked for a quote.', 'COMPANY')).toEqual([]);
  });
});

describe('stage rule', () => {
  it('prefers an explicit stage statement over an incidental mention', async () => {
    const fact = await one(
      'They are in discovery and asked for a quote. We will send the quote on Thursday.',
      'STAGE',
    );
    expect(fact?.value).toBe('DISCOVERY');
    expect(fact?.sourceSentenceIndex).toBe(0);
  });

  it('follows a reversal to the later stage', async () => {
    const fact = await one(
      'Pinegate Systems is no longer in negotiation. They have moved back to discovery.',
      'STAGE',
    );
    expect(fact?.value).toBe('DISCOVERY');
  });

  it('ignores a stage that is negated', async () => {
    expect(await valuesFor('They are not in negotiation yet.', 'STAGE')).toEqual([]);
  });

  it('reads a closed won signal', async () => {
    expect(await valuesFor('Verdant Mills signed the contract this morning.', 'STAGE')).toEqual([
      'CLOSED_WON',
    ]);
  });

  it('reads a closed lost signal', async () => {
    expect(await valuesFor('They went with another vendor.', 'STAGE')).toEqual(['CLOSED_LOST']);
  });
});

describe('amount rule', () => {
  it('takes the later amount when the figure changes', async () => {
    const fact = await one(
      'They asked for a quote around $40,000. The number came down to $32,000.',
      'AMOUNT',
    );
    expect(fact?.value).toBe('32000.00 USD');
    expect(fact?.sourceSentenceIndex).toBe(1);
  });

  it('reads a thousands shorthand', async () => {
    expect(await valuesFor('The pilot is $12.5k for year one.', 'AMOUNT')).toEqual([
      '12500.00 USD',
    ]);
  });

  it('reads an amount written after the number', async () => {
    expect(await valuesFor('They approved 27,500 USD.', 'AMOUNT')).toEqual(['27500.00 USD']);
  });

  it('ignores a bare number with no currency', async () => {
    expect(await valuesFor('They want pricing for 40 sites.', 'AMOUNT')).toEqual([]);
  });

  it('ignores an amount that is negated', async () => {
    expect(await valuesFor('The budget is not $40,000.', 'AMOUNT')).toEqual([]);
  });
});

describe('next step rule', () => {
  it('reads the clause after a modal cue', async () => {
    const fact = await one('We will send the revised quote on Thursday.', 'NEXT_STEP');
    expect(fact?.value).toBe('send the revised quote on Thursday');
  });

  it('reads the clause after a header cue', async () => {
    const fact = await one('Next steps are to map their current workflow.', 'NEXT_STEP');
    expect(fact?.value).toBe('to map their current workflow');
  });

  it('ignores a next step behind a negated modal', async () => {
    expect(await valuesFor('We will not send anything while she is away.', 'NEXT_STEP')).toEqual(
      [],
    );
  });

  it('ignores a next step behind a plain negation', async () => {
    expect(await valuesFor('No next steps until legal signs off.', 'NEXT_STEP')).toEqual([]);
  });

  it('takes the last next step when several are stated', async () => {
    const fact = await one('We will send a deck. We will book a call on Friday.', 'NEXT_STEP');
    expect(fact?.sourceSentenceIndex).toBe(1);
  });
});

describe('extraction result', () => {
  let facts: ExtractedFact[];

  beforeEach(async () => {
    facts = await factsFor(
      'Call with Imani Dorsey at Harbor Lane Logistics went well. They are in discovery and asked for a quote around $40,000. We will send the quote on Thursday.',
    );
  });

  it('gives every fact a sentence index inside the note', async () => {
    const sentenceCount = (
      await extractor.extract({
        body: 'Call with Imani Dorsey at Harbor Lane Logistics went well. They are in discovery and asked for a quote around $40,000. We will send the quote on Thursday.',
      })
    ).sentences.length;
    for (const fact of facts) {
      expect(fact.sourceSentenceIndex).toBeGreaterThanOrEqual(0);
      expect(fact.sourceSentenceIndex).toBeLessThan(sentenceCount);
    }
  });

  it('orders facts by the sentence they came from', () => {
    const indexes = facts.map((fact) => fact.sourceSentenceIndex);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('reports its own name', async () => {
    expect((await extractor.extract({ body: 'Nothing here.' })).extractorName).toBe('rule-based');
  });
});
