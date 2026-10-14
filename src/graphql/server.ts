import { ApolloServer } from '@apollo/server';

import { seedMemoryRepository } from '../db/memory';
import { PostgresRepository } from '../db/postgres';
import type { Repository } from '../db/types';
import { selectExtractor } from '../extraction';
import type { Extractor } from '../extraction/types';
import type { GraphQLContext } from './context';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';

export function createApolloServer(): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
}

let repositoryPromise: Promise<Repository> | null = null;

/**
 * Pick the store. With DATABASE_URL set the PostgreSQL repository is used; without it the app
 * falls back to the in memory repository seeded from data/, so a clean clone runs with no
 * database and the test suite needs nothing external.
 */
export function resolveRepository(env: NodeJS.ProcessEnv = process.env): Promise<Repository> {
  if (repositoryPromise === null) {
    const url = env.DATABASE_URL;
    repositoryPromise =
      url === undefined || url === ''
        ? seedMemoryRepository()
        : (async () => {
            const repository = PostgresRepository.fromUrl(url);
            await repository.migrate();
            if ((await repository.countNotes()) === 0) {
              const { loadNotes } = await import('../data/datasets');
              const { buildIngestPayload } = await import('../db/memory');
              for (const record of loadNotes()) {
                await repository.ingest(await buildIngestPayload(record));
              }
            }
            return repository;
          })();
  }
  return repositoryPromise;
}

export function describeStore(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  return url === undefined || url === ''
    ? 'in memory repository seeded from data/'
    : 'postgresql repository';
}

export function resolveExtractor(env: NodeJS.ProcessEnv = process.env): Extractor {
  return selectExtractor(env);
}
