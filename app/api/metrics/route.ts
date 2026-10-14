import { metrics } from '@/src/observability/metrics';
import { describeStore } from '@/src/graphql/server';
import { describeExtractorChoice } from '@/src/extraction';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  metrics.recordRequest('GET /api/metrics');
  return Response.json({
    store: describeStore(),
    extractor: describeExtractorChoice(),
    ...metrics.snapshot(),
  });
}
