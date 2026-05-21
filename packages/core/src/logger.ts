import { pino, type Logger as PinoLogger, type LoggerOptions } from 'pino';

export type Logger = PinoLogger;

export interface CreateLoggerOptions {
  level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  name?: string;
  pretty?: boolean;
  redact?: string[];
  base?: Record<string, unknown> | null;
}

const DEFAULT_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["api-key"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'headers["x-api-key"]',
  'headers["api-key"]',
];

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const opts: LoggerOptions = {
    level: options.level ?? 'info',
    redact: { paths: [...DEFAULT_REDACT_PATHS, ...(options.redact ?? [])], censor: '[REDACTED]' },
  };
  if (options.name !== undefined) opts.name = options.name;
  if (options.base !== undefined) opts.base = options.base;
  if (options.pretty) {
    opts.transport = { target: 'pino-pretty', options: { colorize: true } };
  }
  return pino(opts);
}

export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}
