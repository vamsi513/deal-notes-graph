import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { HeaderMap } from '@apollo/server';

import { createContext } from '../src/graphql/context';
import {
  BODY_TOO_LARGE_MESSAGE,
  declaredLengthWithinLimit,
  measureBody,
} from '../src/graphql/limits';
import { describeMode, persistsIngestedNotes } from '../src/config';
import {
  createApolloServer,
  describeStore,
  resolveExtractor,
  resolveRepository,
} from '../src/graphql/server';
import { createLogger } from '../src/observability/logger';
import { metrics } from '../src/observability/metrics';
import { describeExtractorChoice } from '../src/extraction';

const PORT = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * The standalone API used by Docker Compose. It serves the GraphQL endpoint plus the health
 * and metrics endpoints on one port, built on Apollo Server's own HTTP integration hook so
 * that no extra web framework is needed.
 */
async function main(): Promise<void> {
  const apollo = createApolloServer();
  await apollo.start();
  const repository = await resolveRepository();
  const extractor = resolveExtractor();

  const server = createServer((request, response) => {
    void handle(request, response);
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = headerValue(request, REQUEST_ID_HEADER) ?? randomUUID();
    const logger = createLogger(requestId);
    const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
    const route = `${request.method ?? 'GET'} ${url.pathname}`;
    const startedAt = performance.now();
    metrics.recordRequest(route);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    try {
      if (url.pathname === '/health') {
        send(response, 200, { status: 'ok', store: describeStore(), mode: describeMode() });
      } else if (url.pathname === '/metrics') {
        send(response, 200, metrics.snapshot());
      } else if (url.pathname === '/graphql') {
        await handleGraphql(request, response, url, requestId);
      } else {
        send(response, 404, { error: 'not found' });
      }
      logger.info('request complete', {
        route,
        status: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
      });
    } catch (error) {
      metrics.recordError();
      logger.error('request failed', {
        route,
        message: error instanceof Error ? error.message : 'unknown error',
      });
      if (!response.headersSent) send(response, 500, { error: 'internal server error' });
    }
  }

  async function handleGraphql(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    requestId: string,
  ): Promise<void> {
    if (!declaredLengthWithinLimit(headerValue(request, 'content-length'))) {
      send(response, 413, { errors: [{ message: BODY_TOO_LARGE_MESSAGE }] });
      return;
    }
    const headers = new HeaderMap();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(', '));
    }
    const raw = await readBody(request);
    if (!measureBody(raw).withinLimit) {
      send(response, 413, { errors: [{ message: BODY_TOO_LARGE_MESSAGE }] });
      return;
    }
    const result = await apollo.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: request.method ?? 'POST',
        headers,
        search: url.search,
        body: raw === '' ? undefined : JSON.parse(raw),
      },
      context: async () =>
        createContext({
          repository,
          extractor,
          requestId,
          metrics,
          persistIngestedNotes: persistsIngestedNotes(),
        }),
    });
    for (const [name, value] of result.headers) response.setHeader(name, value);
    response.statusCode = result.status ?? 200;
    if (result.body.kind === 'complete') {
      response.end(result.body.string);
      return;
    }
    for await (const chunk of result.body.asyncIterator) response.write(chunk);
    response.end();
  }

  server.listen(PORT, () => {
    const logger = createLogger('startup');
    logger.info('api listening', {
      port: PORT,
      graphql: `http://localhost:${PORT}/graphql`,
      metrics: `http://localhost:${PORT}/metrics`,
      store: describeStore(),
      mode: describeMode(),
      extractor: describeExtractorChoice(),
    });
  });
}

function headerValue(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body, null, 2));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
