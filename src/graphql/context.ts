import type { Repository } from '../db/types';
import type { Extractor } from '../extraction/types';
import type { Logger } from '../observability/logger';
import { createLogger, type LogSink } from '../observability/logger';
import type { Metrics } from '../observability/metrics';
import { metrics as sharedMetrics } from '../observability/metrics';
import { createLoaders, type Loaders } from './loaders';

export interface GraphQLContext {
  repository: Repository;
  loaders: Loaders;
  logger: Logger;
  metrics: Metrics;
  extractor: Extractor;
  newNoteId: () => string;
}

export interface ContextOptions {
  repository: Repository;
  extractor: Extractor;
  requestId: string;
  metrics?: Metrics;
  logSink?: LogSink;
  newNoteId?: () => string;
}

export function createContext(options: ContextOptions): GraphQLContext {
  return {
    repository: options.repository,
    loaders: createLoaders(options.repository),
    logger: createLogger(options.requestId, options.logSink),
    metrics: options.metrics ?? sharedMetrics,
    extractor: options.extractor,
    newNoteId: options.newNoteId ?? (() => `note-${Math.random().toString(36).slice(2, 10)}`),
  };
}
