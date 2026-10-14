import { ApolloServer } from '@apollo/server';

import { seedMemoryRepository } from '../db/memory';
import type { Repository } from '../db/types';
import { selectExtractor } from '../extraction';
import type { EnvLike, Extractor } from '../extraction/types';
import type { GraphQLContext } from './context';
import { validationRules } from './limits';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { isDemoMode } from '../config';

export function createApolloServer(): ApolloServer<GraphQLContext> {
  // The endpoint is public in the deployed demo, so depth and selection ceilings apply to
  // every request rather than being a deployment time choice.
  return new ApolloServer<GraphQLContext>({ typeDefs, resolvers, validationRules });
}

let repositoryPromise: Promise<Repository> | null = null;

/**
 * Pick the store. With DATABASE_URL set the PostgreSQL repository is used; without it the app
 * falls back to the in memory repository seeded from data/, so a clean clone runs with no
 * database and the test suite needs nothing external.
 */
export function resolveRepository(env: EnvLike = process.env): Promise<Repository> {
  if (repositoryPromise === null) {
    const url = env.DATABASE_URL;
    repositoryPromise =
      url === undefined || url === ''
        ? seedMemoryRepository()
        : (async () => {
            // Imported here so that a build with no database never pulls in the driver.
            const { PostgresRepository } = await import('../db/postgres');
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

export function describeStore(env: EnvLike = process.env): string {
  const url = env.DATABASE_URL;
  return url === undefined || url === ''
    ? 'in memory repository seeded from data/'
    : 'postgresql repository';
}

export function resolveExtractor(env: EnvLike = process.env): Extractor {
  return selectExtractor(env, isDemoMode(env));
}
