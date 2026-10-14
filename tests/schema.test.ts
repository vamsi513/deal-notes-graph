import { buildSchema, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';

import { typeDefs } from '../src/graphql/schema';

const schema = buildSchema(typeDefs);

describe('schema', () => {
  it('builds without an error', () => {
    expect(printSchema(schema).length).toBeGreaterThan(0);
  });

  it('declares the five core types', () => {
    for (const name of ['Contact', 'Company', 'Deal', 'Note', 'Fact']) {
      expect(schema.getType(name), name).toBeDefined();
    }
  });

  it('gives a Fact its source sentence and note', () => {
    const fields = Object.keys(schema.getQueryType()?.getFields() ?? {});
    expect(fields).toContain('facts');
    const fact = schema.getType('Fact');
    const factFields = Object.keys(
      (fact as unknown as { getFields: () => Record<string, unknown> }).getFields(),
    );
    expect(factFields).toContain('sourceSentence');
    expect(factFields).toContain('sourceSentenceIndex');
    expect(factFields).toContain('noteId');
    expect(factFields).toContain('grounded');
  });

  it('declares the four required queries', () => {
    const fields = Object.keys(schema.getQueryType()?.getFields() ?? {});
    for (const name of ['notes', 'note', 'facts', 'deals']) {
      expect(fields, name).toContain(name);
    }
  });

  it('declares the ingest mutation', () => {
    const fields = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(fields).toContain('ingestNote');
  });

  it('lists every deal stage in the enum', () => {
    const stage = schema.getType('DealStage');
    const values = (stage as unknown as { getValues: () => Array<{ name: string }> })
      .getValues()
      .map((value) => value.name);
    expect(values).toEqual([
      'PROSPECT',
      'DISCOVERY',
      'QUALIFIED',
      'PROPOSAL',
      'NEGOTIATION',
      'CLOSED_WON',
      'CLOSED_LOST',
    ]);
  });

  it('lists every fact field in the enum', () => {
    const field = schema.getType('FactField');
    const values = (field as unknown as { getValues: () => Array<{ name: string }> })
      .getValues()
      .map((value) => value.name);
    expect(values).toEqual(['CONTACT', 'COMPANY', 'STAGE', 'AMOUNT', 'NEXT_STEP']);
  });
});
