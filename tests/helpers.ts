import type { ApolloServer } from '@apollo/server';

import { loadNotes } from '../src/data/datasets';
import { seedMemoryRepository } from '../src/db/memory';
import type { MemoryRepository } from '../src/db/memory';
import { RuleBasedExtractor } from '../src/extraction/rules';
import type { Extractor } from '../src/extraction/types';
import { createContext } from '../src/graphql/context';
import { createApolloServer } from '../src/graphql/server';
import type { GraphQLContext } from '../src/graphql/context';
import { Metrics } from '../src/observability/metrics';
import type { LogRecord } from '../src/observability/logger';

export interface Harness {
  server: ApolloServer<GraphQLContext>;
  repository: MemoryRepository;
  metrics: Metrics;
  logs: LogRecord[];
  context: () => GraphQLContext;
  run: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  stop: () => Promise<void>;
}

export interface HarnessOptions {
  extractor?: Extractor;
  /** Defaults to true, the full mode behaviour. Pass false to exercise demo mode. */
  persistIngestedNotes?: boolean;
}

/** A server over a seeded in memory repository. Nothing here touches a network or a database. */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const extractor = options.extractor ?? new RuleBasedExtractor();
  const persistIngestedNotes = options.persistIngestedNotes ?? true;
  const repository = await seedMemoryRepository(loadNotes());
  const metrics = new Metrics();
  const logs: LogRecord[] = [];
  const server = createApolloServer();
  await server.start();

  let counter = 0;
  const context = (): GraphQLContext =>
    createContext({
      repository,
      extractor,
      requestId: 'test-request',
      metrics,
      logSink: (record) => logs.push(record),
      newNoteId: () => `generated-${(counter += 1)}`,
      persistIngestedNotes,
    });

  async function run<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await server.executeOperation(
      { query, variables },
      { contextValue: context() },
    );
    if (response.body.kind !== 'single') throw new Error('unexpected incremental response');
    const { data, errors } = response.body.singleResult;
    if (errors !== undefined && errors.length > 0) {
      throw new Error(errors.map((error) => error.message).join('; '));
    }
    return data as T;
  }

  async function runExpectingError(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await server.executeOperation(
      { query, variables },
      { contextValue: context() },
    );
    if (response.body.kind !== 'single') throw new Error('unexpected incremental response');
    const { errors } = response.body.singleResult;
    return errors?.map((error) => error.message).join('; ') ?? '';
  }

  return {
    server,
    repository,
    metrics,
    logs,
    context,
    run,
    stop: () => server.stop(),
    // exposed for the error path test
    ...{ runExpectingError },
  } as Harness & { runExpectingError: typeof runExpectingError };
}
