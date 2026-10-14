export interface LatencySummary {
  count: number;
  totalMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface MetricsSnapshot {
  startedAt: string;
  uptimeSeconds: number;
  requests: Record<string, number>;
  graphqlOperations: Record<string, number>;
  errors: number;
  extraction: LatencySummary;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const position = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[position] ?? 0;
}

/**
 * A small in process registry. Counts are per process and reset when the process restarts,
 * which is all a prototype needs and is stated plainly in the README.
 */
export class Metrics {
  private readonly started = Date.now();
  private readonly requests = new Map<string, number>();
  private readonly operations = new Map<string, number>();
  private readonly extractionMs: number[] = [];
  private errors = 0;

  constructor(private readonly maxSamples = 1_000) {}

  recordRequest(route: string): void {
    this.requests.set(route, (this.requests.get(route) ?? 0) + 1);
  }

  recordOperation(name: string): void {
    this.operations.set(name, (this.operations.get(name) ?? 0) + 1);
  }

  recordError(): void {
    this.errors += 1;
  }

  recordExtraction(durationMs: number): void {
    this.extractionMs.push(durationMs);
    if (this.extractionMs.length > this.maxSamples) this.extractionMs.shift();
  }

  snapshot(now: number = Date.now()): MetricsSnapshot {
    const sorted = [...this.extractionMs].sort((a, b) => a - b);
    const totalMs = sorted.reduce((sum, value) => sum + value, 0);
    return {
      startedAt: new Date(this.started).toISOString(),
      uptimeSeconds: Math.round((now - this.started) / 1000),
      requests: Object.fromEntries([...this.requests.entries()].sort()),
      graphqlOperations: Object.fromEntries([...this.operations.entries()].sort()),
      errors: this.errors,
      extraction: {
        count: sorted.length,
        totalMs: round(totalMs),
        meanMs: sorted.length === 0 ? 0 : round(totalMs / sorted.length),
        p50Ms: round(percentile(sorted, 0.5)),
        p95Ms: round(percentile(sorted, 0.95)),
        maxMs: round(sorted[sorted.length - 1] ?? 0),
      },
    };
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** One registry per process, shared by the Next route and the standalone server. */
export const metrics = new Metrics();
