import { randomUUID } from 'node:crypto';

import { startServerAndCreateNextHandler } from '@as-integrations/next';
import type { NextRequest } from 'next/server';

import type { GraphQLContext } from '@/src/graphql/context';

import { createContext } from '@/src/graphql/context';
import { createApolloServer, resolveExtractor, resolveRepository } from '@/src/graphql/server';
import { REQUEST_ID_HEADER, createLogger, requestIdFrom } from '@/src/observability/logger';
import { metrics } from '@/src/observability/metrics';

export const dynamic = 'force-dynamic';

const server = createApolloServer();

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: async (request) => {
    const requestId = requestIdFrom(request.headers, randomUUID);
    const logger = createLogger(requestId);
    metrics.recordRequest(`${request.method} /api/graphql`);
    logger.info('graphql request', { route: '/api/graphql' });
    return createContext({
      repository: await resolveRepository(),
      extractor: resolveExtractor(),
      requestId,
      metrics,
    });
  },
});

export async function GET(request: NextRequest): Promise<Response> {
  return withRequestId(request, await handler(request));
}

export async function POST(request: NextRequest): Promise<Response> {
  return withRequestId(request, await handler(request));
}

function withRequestId(request: NextRequest, response: Response): Response {
  const requestId = request.headers.get(REQUEST_ID_HEADER);
  if (requestId !== null) response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
