import { executeGraphql } from '../graphql/local';
import { metrics } from '../observability/metrics';

/**
 * Where the pages read from.
 *
 * With GRAPHQL_URL set the pages call that endpoint over HTTP, which is how they talk to the
 * API container under Docker Compose. Without it they run the same operation in process
 * against the same schema, so the app renders from a clean clone with nothing else running.
 */
export async function query<T>(
  document: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const url = process.env.GRAPHQL_URL;
  if (url === undefined || url === '') return executeGraphql<T>(document, variables);

  metrics.recordRequest('POST (upstream) /graphql');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: document, variables }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`the graphql endpoint returned ${response.status}`);
  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  if (payload.errors !== undefined && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }
  if (payload.data === undefined) throw new Error('the query returned no data');
  return payload.data;
}
