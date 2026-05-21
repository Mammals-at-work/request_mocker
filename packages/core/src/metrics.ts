import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export interface MockServerMetrics {
  registry: Registry;
  requestsTotal: Counter<'method' | 'path' | 'status' | 'origin'>;
  requestDurationSeconds: Histogram<'method' | 'path' | 'status'>;
  requestsInFlight: Gauge<string>;
  record(args: {
    method: string;
    path: string;
    status: number;
    origin: string;
    durationMs: number;
  }): void;
}

export interface CreateMetricsOptions {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefault?: boolean;
  buckets?: number[];
}

export function createMetrics(options: CreateMetricsOptions = {}): MockServerMetrics {
  const registry = new Registry();
  const prefix = options.prefix ?? 'mock_';
  if (options.defaultLabels) registry.setDefaultLabels(options.defaultLabels);
  if (options.collectDefault) collectDefaultMetrics({ register: registry, prefix });

  const requestsTotal = new Counter({
    name: `${prefix}requests_total`,
    help: 'Total number of HTTP requests handled by the mock server.',
    labelNames: ['method', 'path', 'status', 'origin'] as const,
    registers: [registry],
  });

  const requestDurationSeconds = new Histogram({
    name: `${prefix}request_duration_seconds`,
    help: 'Duration of HTTP requests in seconds.',
    labelNames: ['method', 'path', 'status'] as const,
    buckets: options.buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const requestsInFlight = new Gauge({
    name: `${prefix}requests_in_flight`,
    help: 'Number of in-flight HTTP requests.',
    registers: [registry],
  });

  return {
    registry,
    requestsTotal,
    requestDurationSeconds,
    requestsInFlight,
    record({ method, path, status, origin, durationMs }) {
      const status3 = String(status);
      requestsTotal.inc({ method, path, status: status3, origin });
      requestDurationSeconds.observe({ method, path, status: status3 }, durationMs / 1000);
    },
  };
}
