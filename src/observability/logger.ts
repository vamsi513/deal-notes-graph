export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  message: string;
  requestId: string;
  timestamp: string;
  [key: string]: unknown;
}

export type LogSink = (record: LogRecord) => void;

/** One JSON object per line, so the output can be read by eye or piped into anything. */
export const jsonLineSink: LogSink = (record) => {
  process.stdout.write(`${JSON.stringify(record)}\n`);
};

export interface Logger {
  readonly requestId: string;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** Keys that are never written to a log line, whatever a caller passes. */
const REDACTED_KEYS = /authorization|cookie|api[_-]?key|token|secret|password/i;

export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(fields)) {
    out[name] = REDACTED_KEYS.test(name) ? '[redacted]' : value;
  }
  return out;
}

export function createLogger(
  requestId: string,
  sink: LogSink = jsonLineSink,
  now: () => Date = () => new Date(),
): Logger {
  const write = (level: LogLevel, message: string, fields: Record<string, unknown> = {}): void => {
    sink({
      level,
      message,
      requestId,
      timestamp: now().toISOString(),
      ...redact(fields),
    });
  };
  return {
    requestId,
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}

export const REQUEST_ID_HEADER = 'x-request-id';

/** Reuse an inbound request id when there is one so a trace survives a hop. */
export function requestIdFrom(headers: Headers | undefined, fallback: () => string): string {
  const inbound = headers?.get(REQUEST_ID_HEADER);
  return inbound !== null && inbound !== undefined && inbound.trim() !== ''
    ? inbound.trim()
    : fallback();
}
