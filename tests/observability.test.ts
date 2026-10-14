import { describe, expect, it } from 'vitest';

import {
  REQUEST_ID_HEADER,
  createLogger,
  redact,
  requestIdFrom,
} from '../src/observability/logger';
import type { LogRecord } from '../src/observability/logger';
import { Metrics } from '../src/observability/metrics';

describe('logger', () => {
  it('writes a structured record carrying the request id', () => {
    const records: LogRecord[] = [];
    createLogger('req-1', (record) => records.push(record)).info('note ingested', {
      noteId: 'n01',
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe('info');
    expect(records[0]?.requestId).toBe('req-1');
    expect(records[0]?.noteId).toBe('n01');
    expect(typeof records[0]?.timestamp).toBe('string');
  });

  it('writes every level', () => {
    const records: LogRecord[] = [];
    const logger = createLogger('req-2', (record) => records.push(record));
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(records.map((record) => record.level)).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('never writes a credential like field', () => {
    expect(redact({ authorization: 'Bearer abc', apiKey: 'xyz', noteId: 'n01' })).toEqual({
      authorization: '[redacted]',
      apiKey: '[redacted]',
      noteId: 'n01',
    });
  });

  it('reuses an inbound request id', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'from-upstream' });
    expect(requestIdFrom(headers, () => 'generated')).toBe('from-upstream');
  });

  it('generates a request id when there is none', () => {
    expect(requestIdFrom(new Headers(), () => 'generated')).toBe('generated');
    expect(requestIdFrom(undefined, () => 'generated')).toBe('generated');
  });
});

describe('metrics', () => {
  it('counts requests and operations by name', () => {
    const metrics = new Metrics();
    metrics.recordRequest('POST /graphql');
    metrics.recordRequest('POST /graphql');
    metrics.recordRequest('GET /metrics');
    metrics.recordOperation('notes');
    const snapshot = metrics.snapshot();
    expect(snapshot.requests['POST /graphql']).toBe(2);
    expect(snapshot.requests['GET /metrics']).toBe(1);
    expect(snapshot.graphqlOperations.notes).toBe(1);
  });

  it('summarises extraction latency', () => {
    const metrics = new Metrics();
    for (const value of [10, 20, 30, 40]) metrics.recordExtraction(value);
    const { extraction } = metrics.snapshot();
    expect(extraction.count).toBe(4);
    expect(extraction.totalMs).toBe(100);
    expect(extraction.meanMs).toBe(25);
    expect(extraction.p50Ms).toBe(30);
    expect(extraction.maxMs).toBe(40);
  });

  it('reports zeros before anything is recorded', () => {
    const { extraction, errors } = new Metrics().snapshot();
    expect(extraction).toEqual({
      count: 0,
      totalMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0,
    });
    expect(errors).toBe(0);
  });

  it('keeps at most the configured number of latency samples', () => {
    const metrics = new Metrics(3);
    for (const value of [1, 2, 3, 4, 5]) metrics.recordExtraction(value);
    expect(metrics.snapshot().extraction.count).toBe(3);
    expect(metrics.snapshot().extraction.maxMs).toBe(5);
  });

  it('counts errors', () => {
    const metrics = new Metrics();
    metrics.recordError();
    metrics.recordError();
    expect(metrics.snapshot().errors).toBe(2);
  });
});
