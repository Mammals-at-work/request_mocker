import { getOverride } from '../db';
import type { OpenApiDocument, OpenApiResponse, OverridesDocument } from '../specLoader';
import type { AdapterRequest, AdapterResponse, MockAdapter, RouteSummary } from './types';

export interface Route {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export class OpenApiAdapter implements MockAdapter {
  readonly id = 'openapi';
  readonly name = 'OpenAPI';

  constructor(private readonly routes: Record<string, Route>) {}

  match(request: AdapterRequest): boolean {
    return Boolean(this.routes[this.routeKey(request)]);
  }

  async handle(request: AdapterRequest): Promise<AdapterResponse> {
    const key = this.routeKey(request);
    const route = this.routes[key];
    if (!route) {
      return { status: 404, body: 'Not Found', origin: 'miss' };
    }

    const override = await getOverride(
      request.method.toLowerCase(),
      request.url,
      route.status,
    ).catch(() => null);

    if (override && override.body) {
      let body: unknown;
      try {
        body = JSON.parse(override.body);
      } catch {
        body = override.body;
      }
      return { status: override.status, body, origin: 'override' };
    }

    const response: AdapterResponse = {
      status: route.status,
      body: route.body,
      origin: 'openapi',
    };
    if (route.headers) response.headers = route.headers;
    return response;
  }

  listRoutes(): Record<string, RouteSummary> {
    return this.routes;
  }

  private routeKey(request: AdapterRequest): string {
    return `${request.method.toLowerCase()} ${request.url}`;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractExample(response: OpenApiResponse | undefined): unknown {
  const content = response?.content;
  if (!content) return {};
  const json = content['application/json'];
  if (json && 'example' in json && json.example !== undefined) return json.example;
  const text = content['text/plain'];
  if (text && 'example' in text && text.example !== undefined) return text.example;
  return {};
}

function pickPrimaryResponse(
  responses: Record<string, OpenApiResponse>,
): { status: number; response: OpenApiResponse } | undefined {
  if (responses['200']) return { status: 200, response: responses['200'] };
  const keys = Object.keys(responses);
  const firstKey = keys[0];
  if (firstKey === undefined) return undefined;
  const first = responses[firstKey];
  if (!first) return undefined;
  const parsed = parseInt(firstKey, 10);
  return { status: Number.isFinite(parsed) ? parsed : 200, response: first };
}

export function buildRoutes(spec: OpenApiDocument): Record<string, Route> {
  const routes: Record<string, Route> = {};
  const paths = spec.paths;
  if (!paths) return routes;
  for (const pathKey of Object.keys(paths)) {
    const methods = paths[pathKey];
    if (!methods) continue;
    for (const method of Object.keys(methods)) {
      const detail = methods[method];
      if (!detail) continue;
      const responses = detail.responses ?? {};
      const picked = pickPrimaryResponse(responses);
      const body = extractExample(picked?.response);
      routes[`${method.toLowerCase()} ${pathKey}`] = {
        status: picked?.status ?? 200,
        body,
      };
    }
  }
  return routes;
}

export function applyRouteOverrides(
  routes: Record<string, Route>,
  overrides: OverridesDocument,
): Record<string, Route> {
  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    const existing = routes[key];
    if (existing) {
      if (isPlainObject(val) && 'body' in val) {
        existing.body = (val as { body: unknown }).body;
        const overrideStatus = (val as { status?: number }).status;
        if (overrideStatus !== undefined) existing.status = overrideStatus;
      } else {
        existing.body = val;
      }
    } else {
      if (isPlainObject(val) && 'body' in val) {
        const status = (val as { status?: number }).status;
        routes[key] = {
          status: status ?? 200,
          body: (val as { body: unknown }).body,
        };
      } else {
        routes[key] = { status: 200, body: val };
      }
    }
  }
  return routes;
}
