import { randomUUID } from 'node:crypto';

import type { ApolloServer } from '@apollo/server';

import { metrics } from '../observability/metrics';
import { createContext } from './context';
import { createApolloServer, resolveExtractor, resolveRepository } from './server';
import type { GraphQLContext } from './context';

let started: Promise<ApolloServer<GraphQLContext>> | null = null;

function server(): Promise<ApolloServer<GraphQLContext>> {
  if (started === null) {
    started = (async () => {
      const instance = createApolloServer();
      await instance.start();
      return instance;
    })();
  }
  return started;
}

/**
 * Run an operation against the same schema, resolvers and loaders the HTTP endpoint uses,
 * without a network hop. The pages use this when no GRAPHQL_URL is configured, so a clean
 * clone renders with one command and no running API container.
 */
export async function executeGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const instance = await server();
  const response = await instance.executeOperation(
    { query, variables },
    {
      contextValue: createContext({
        repository: await resolveRepository(),
        extractor: resolveExtractor(),
        requestId: randomUUID(),
        metrics,
      }),
    },
  );
  if (response.body.kind !== 'single') {
    throw new Error('this client does not handle incremental responses');
  }
  const { data, errors } = response.body.singleResult;
  if (errors !== undefined && errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join('; '));
  }
  if (data === null || data === undefined) throw new Error('the query returned no data');
  return data as T;
}
