import { randomUUID } from 'node:crypto';

import { startServerAndCreateNextHandler } from '@as-integrations/next';
import type { NextRequest } from 'next/server';

import { isDemoMode, persistsIngestedNotes } from '@/src/config';
import type { GraphQLContext } from '@/src/graphql/context';
import { createContext } from '@/src/graphql/context';
import {
  BODY_TOO_LARGE_MESSAGE,
  declaredLengthWithinLimit,
  measureBody,
} from '@/src/graphql/limits';
import { createApolloServer, resolveExtractor, resolveRepository } from '@/src/graphql/server';
import { REQUEST_ID_HEADER, createLogger, requestIdFrom } from '@/src/observability/logger';
import { metrics } from '@/src/observability/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const server = createApolloServer();

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: async (request) => {
    const requestId = requestIdFrom(request.headers, randomUUID);
    metrics.recordRequest(`${request.method} /api/graphql`);
    // Route and method only. A request body is never logged.
    createLogger(requestId).info('graphql request', { route: '/api/graphql' });
    return createContext({
      repository: await resolveRepository(),
      extractor: resolveExtractor(),
      requestId,
      metrics,
      persistIngestedNotes: persistsIngestedNotes(),
    });
  },
});

/**
 * Refuse an oversized body before it reaches the parser. The declared length is checked
 * first because it is free, then the body is measured, because the header can be absent or
 * wrong.
 */
async function withinBodyLimit(request: NextRequest): Promise<boolean> {
  if (!declaredLengthWithinLimit(request.headers.get('content-length'))) return false;
  if (request.method === 'GET' || request.body === null) return true;
  return measureBody(await request.clone().text()).withinLimit;
}

function tooLarge(requestId: string | null): Response {
  metrics.recordRequest('REJECTED /api/graphql (body too large)');
  const response = Response.json(
    { errors: [{ message: BODY_TOO_LARGE_MESSAGE, extensions: { code: 'BODY_TOO_LARGE' } }] },
    { status: 413 },
  );
  if (requestId !== null) response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

async function serve(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get(REQUEST_ID_HEADER);
  if (!(await withinBodyLimit(request))) return tooLarge(requestId);
  const response = await handler(request);
  if (requestId !== null) response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set('x-demo-mode', String(isDemoMode()));
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  return serve(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return serve(request);
}
