import type { IncomingHttpHeaders } from 'http';

export type AdapterResponseOrigin =
  | 'openapi'
  | 'override'
  | 'recorded'
  | 'replayed'
  | 'miss'
  | 'error';

export type AdapterHeaderValue = string | string[] | undefined;
export type AdapterHeaders = IncomingHttpHeaders | Record<string, AdapterHeaderValue>;

export interface AdapterRequest {
  method: string;
  url: string;
  headers: AdapterHeaders;
  body?: string;
}

export interface AdapterResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  origin: AdapterResponseOrigin;
}

export interface RouteSummary {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  source?: string;
}

export interface MockAdapter {
  id: string;
  name: string;
  match(request: AdapterRequest): boolean;
  handle(request: AdapterRequest): Promise<AdapterResponse>;
  listRoutes(): Record<string, RouteSummary>;
}
