import http from 'http';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  FigmaProxyOptions,
  FigmaProxyAdapter,
  listFigmaCassettes,
} from './adapters/figmaProxyAdapter';
import {
  applyRouteOverrides,
  buildRoutes,
  OpenApiAdapter,
  Route,
} from './adapters/openApiAdapter';
import { AdapterResponse, MockAdapter, RouteSummary } from './adapters/types';
import { loadSpecFile, type OverridesDocument } from './specLoader';
import { createSilentLogger, type Logger } from './logger';
import type { MockServerMetrics } from './metrics';

export interface LogEntry {
  data: LogEntryData;
  request?: LogEntryRequest;
  response?: LogEntryResponse;
  system?: LogSystem;
  requestId?: string;
}

export interface LogEntryData {
  timestamp: number;
  responseTime: number;
}

export interface LogSystem {
  msg: string;
}

export interface LogEntryRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body?: string;
}

export interface LogEntryResponse {
  status: number;
  headers?: Record<string, string | number | string[]>;
  body?: unknown;
  origin?: string;
}

export interface InternalEndpointsOptions {
  enabled?: boolean;
  healthPath?: string;
  metricsPath?: string;
}

export interface CommonServerOptions {
  logger?: Logger;
  metrics?: MockServerMetrics;
  requestIdHeader?: string;
  internalEndpoints?: InternalEndpointsOptions;
  logBufferSize?: number;
}

export type MockServerConfig = CommonServerOptions &
  (
    | { mode: 'openapi'; specPath: string; port: number; dataPath?: string }
    | { mode: 'figma-proxy'; port: number; adapterOptions: FigmaProxyOptions }
  );

export interface MockServerHandle {
  server: http.Server;
  logger: Logger;
  metrics?: MockServerMetrics;
  getLogs(): LogEntry[];
  clearLogs(): void;
  setDelay(ms: number): void;
  close(): Promise<void>;
}

export { buildRoutes };
export type { Route };

const DEFAULT_LOG_BUFFER_SIZE = 1000;
const DEFAULT_REQUEST_ID_HEADER = 'x-request-id';
const DEFAULT_HEALTH_PATH = '/__mock__/health';
const DEFAULT_METRICS_PATH = '/__mock__/metrics';

class RingBuffer<T> {
  private buf: T[] = [];
  constructor(private readonly capacity: number) {}
  push(item: T): void {
    this.buf.unshift(item);
    if (this.buf.length > this.capacity) this.buf.length = this.capacity;
  }
  pushBack(item: T): void {
    this.buf.push(item);
    if (this.buf.length > this.capacity) this.buf.shift();
  }
  snapshot(): T[] {
    return this.buf.slice();
  }
  clear(): void {
    this.buf.length = 0;
  }
}

export function startServer(specPath: string, port: number, dataPath?: string): MockServerHandle {
  const config: MockServerConfig = dataPath
    ? { mode: 'openapi', specPath, port, dataPath }
    : { mode: 'openapi', specPath, port };
  return startConfiguredServer(config);
}

export function startConfiguredServer(config: MockServerConfig): MockServerHandle {
  const adapter = createAdapter(config);
  const logger = config.logger ?? createSilentLogger();
  const metrics = config.metrics;
  const requestIdHeader = (config.requestIdHeader ?? DEFAULT_REQUEST_ID_HEADER).toLowerCase();
  const internal = {
    enabled: config.internalEndpoints?.enabled ?? true,
    healthPath: config.internalEndpoints?.healthPath ?? DEFAULT_HEALTH_PATH,
    metricsPath: config.internalEndpoints?.metricsPath ?? DEFAULT_METRICS_PATH,
  };
  const logs = new RingBuffer<LogEntry>(config.logBufferSize ?? DEFAULT_LOG_BUFFER_SIZE);
  const startedAtMs = Date.now();
  let serverDelay = 0;

  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    const requestId = resolveRequestId(req, requestIdHeader);
    res.setHeader(requestIdHeader, requestId);

    if (!req.url || !req.method) {
      sendResponse(req, res, startedAt, { status: 404, body: 'Not Found', origin: 'miss' }, '', logs, serverDelay, logger, metrics, requestId);
      return;
    }

    if (internal.enabled && req.method === 'GET') {
      if (req.url === internal.healthPath) {
        respondHealth(res, startedAtMs);
        return;
      }
      if (metrics && req.url === internal.metricsPath) {
        respondMetrics(res, metrics);
        return;
      }
    }

    metrics?.requestsInFlight.inc();

    let bodyStr = '';
    req.on('data', (chunk: Buffer | string) => {
      bodyStr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    req.on('end', async () => {
      try {
        const request = {
          method: req.method as string,
          url: req.url as string,
          headers: req.headers,
          body: bodyStr,
        };

        const response = adapter.match(request)
          ? await adapter.handle(request)
          : ({ status: 404, body: 'Not Found', origin: 'miss' } as const);

        sendResponse(req, res, startedAt, response, bodyStr, logs, serverDelay, logger, metrics, requestId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected mock server error.';
        logger.error({ requestId, err }, 'mock.request.error');
        sendResponse(
          req,
          res,
          startedAt,
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: message },
            origin: 'error',
          },
          bodyStr,
          logs,
          serverDelay,
          logger,
          metrics,
          requestId,
        );
      }
    });
  });

  server.listen(config.port, '127.0.0.1');
  server.on('error', err => {
    pushSystemLog(logs, `[ SYSTEM ] Server error: ${err.message}`);
    logger.error({ err }, 'mock.server.error');
  });
  server.on('listening', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : config.port;
    pushSystemLog(logs, `[ SYSTEM ] Server listening on: http://localhost:${port}`);
    logger.info({ port, mode: config.mode }, 'mock.server.listening');
  });

  const handle: MockServerHandle = {
    server,
    logger,
    getLogs: () => logs.snapshot(),
    clearLogs: () => logs.clear(),
    setDelay: (ms: number) => {
      serverDelay = ms;
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
  if (metrics) handle.metrics = metrics;
  return handle;
}

export function extractRoutes(specPath: string, dataPath?: string): Record<string, Route> {
  const spec = loadSpecFile(specPath);
  const routes = buildRoutes(spec);
  if (dataPath) {
    applyRouteOverrides(routes, loadSpecFile(dataPath) as OverridesDocument);
  }
  return routes;
}

export function extractConfiguredRoutes(config: MockServerConfig): Record<string, RouteSummary> {
  if (config.mode === 'openapi') return extractRoutes(config.specPath, config.dataPath);
  return listFigmaCassettes(config.adapterOptions.cassetteDir);
}

function createAdapter(config: MockServerConfig): MockAdapter {
  if (config.mode === 'figma-proxy') return new FigmaProxyAdapter(config.adapterOptions);

  const spec = loadSpecFile(config.specPath);
  const routes = buildRoutes(spec);
  if (config.dataPath) {
    applyRouteOverrides(routes, loadSpecFile(config.dataPath) as OverridesDocument);
  }
  return new OpenApiAdapter(routes);
}

function resolveRequestId(req: IncomingMessage, header: string): string {
  const incoming = req.headers[header];
  if (typeof incoming === 'string' && incoming.length > 0) return incoming;
  if (Array.isArray(incoming) && incoming.length > 0 && incoming[0]) return incoming[0];
  return randomUUID();
}

function respondHealth(res: ServerResponse, startedAtMs: number): void {
  const body = JSON.stringify({
    status: 'ok',
    uptimeMs: Date.now() - startedAtMs,
    timestamp: new Date().toISOString(),
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}

function respondMetrics(res: ServerResponse, metrics: MockServerMetrics): void {
  metrics.registry
    .metrics()
    .then(payload => {
      res.statusCode = 200;
      res.setHeader('Content-Type', metrics.registry.contentType);
      res.end(payload);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'metrics error';
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: message }));
    });
}

function sendResponse(
  req: IncomingMessage,
  res: ServerResponse,
  startedAt: number,
  response: AdapterResponse,
  requestBody: string,
  logs: RingBuffer<LogEntry>,
  serverDelay: number,
  logger: Logger,
  metrics: MockServerMetrics | undefined,
  requestId: string,
): void {
  setTimeout(() => {
    const headers = normalizeOutgoingHeaders(response.headers);
    const body: unknown = response.body === undefined ? '' : response.body;
    let renderedBody: string | Buffer;

    res.statusCode = response.status;
    for (const name of Object.keys(headers)) {
      const value = headers[name];
      if (value !== undefined) res.setHeader(name, value);
    }

    if (Buffer.isBuffer(body)) {
      renderedBody = body;
    } else if (body !== null && typeof body === 'object') {
      renderedBody = JSON.stringify(body);
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    } else {
      renderedBody = String(body);
    }

    res.end(renderedBody);
    const durationMs = Date.now() - startedAt;
    const origin = response.origin ?? 'unknown';
    metrics?.requestsInFlight.dec();
    metrics?.record({
      method: req.method ?? '',
      path: req.url ?? '',
      status: response.status,
      origin,
      durationMs,
    });
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.url,
        status: response.status,
        origin,
        durationMs,
      },
      'mock.request',
    );
    pushRequestLog(logs, req, res, startedAt, requestBody, body, response.origin, requestId);
  }, serverDelay);
}

function normalizeOutgoingHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  const skipped = new Set(['connection', 'content-length', 'transfer-encoding']);
  for (const name of Object.keys(headers)) {
    if (skipped.has(name.toLowerCase())) continue;
    const value = headers[name];
    if (value !== undefined) normalized[name] = String(value);
  }
  return normalized;
}

function pushRequestLog(
  logs: RingBuffer<LogEntry>,
  req: IncomingMessage,
  res: ServerResponse,
  startedAt: number,
  requestBody: string,
  responseBody: unknown,
  origin: string | undefined,
  requestId: string,
): void {
  const response: LogEntryResponse = {
    status: res.statusCode,
    headers: res.getHeaders() as Record<string, string | number | string[]>,
    body: Buffer.isBuffer(responseBody) ? responseBody.toString('base64') : responseBody,
  };
  if (origin !== undefined) response.origin = origin;
  logs.push({
    data: {
      timestamp: Date.now(),
      responseTime: Date.now() - startedAt,
    },
    request: {
      method: req.method ?? '',
      path: req.url ?? '',
      headers: req.headers,
      body: requestBody,
    },
    response,
    requestId,
  });
}

function pushSystemLog(logs: RingBuffer<LogEntry>, msg: string): void {
  logs.pushBack({
    data: { timestamp: Date.now(), responseTime: 0 },
    system: { msg },
  });
}
