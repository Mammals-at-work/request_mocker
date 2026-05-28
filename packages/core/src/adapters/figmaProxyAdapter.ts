import https from 'https';
import {
  buildCassetteKey,
  Cassette,
  CassetteStore,
  decodeBody,
  DEFAULT_FIGMA_CASSETTE_DIR,
  encodeBody,
  sanitizeHeaders,
} from './cassetteStore';
import { AdapterRequest, AdapterResponse, MockAdapter, RouteSummary } from './types';

export type FigmaProxyMode = 'record' | 'replay';
export const FIGMA_API_BASE_URL = 'https://api.figma.com/';

export interface FigmaProxyOptions {
  mode: FigmaProxyMode;
  token?: string;
  cassetteDir?: string;
  baseUrl?: string;
  fetcher?: FigmaFetcher;
}

export interface FigmaFetchedResponse {
  status: number;
  headers: Record<string, any>;
  body: Buffer;
}

export type FigmaFetcher = (request: AdapterRequest, options: Required<Pick<FigmaProxyOptions, 'baseUrl'>> & Pick<FigmaProxyOptions, 'token'>) => Promise<FigmaFetchedResponse>;

export class FigmaProxyAdapter implements MockAdapter {
  readonly id = 'figma-proxy';
  readonly name = 'Figma Proxy';
  private readonly mode: FigmaProxyMode;
  private readonly token?: string;
  private readonly baseUrl: string;
  private readonly store: CassetteStore;
  private readonly fetcher: FigmaFetcher;

  constructor(options: FigmaProxyOptions) {
    this.mode = options.mode;
    if (options.token !== undefined) this.token = options.token;
    this.baseUrl = options.baseUrl || FIGMA_API_BASE_URL;
    this.store = new CassetteStore(options.cassetteDir || DEFAULT_FIGMA_CASSETTE_DIR);
    this.fetcher = options.fetcher || fetchFromFigma;
  }

  match(request: AdapterRequest): boolean {
    return request.url.startsWith('/v1/') || request.url.startsWith('/v2/');
  }

  async handle(request: AdapterRequest): Promise<AdapterResponse> {
    if (!this.match(request)) {
      return { status: 404, body: { error: 'Figma adapter only handles /v1/* and /v2/* paths.' }, origin: 'miss' };
    }

    const key = buildCassetteKey(request.method, request.url, request.body || '');

    if (this.mode === 'replay') {
      const cassette = this.store.read(key);
      if (!cassette) {
        return {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
          body: {
            error: 'No recorded Figma cassette found for this request.',
            method: key.method,
            path: key.normalizedPath,
          },
          origin: 'miss',
        };
      }
      return {
        status: cassette.response.status,
        headers: cassette.response.headers,
        body: decodeBody(cassette.response.body),
        origin: 'replayed',
      };
    }

    if (!this.token) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Figma token is required in record mode.' },
        origin: 'error',
      };
    }

    try {
      const upstream = await this.fetcher(request, { baseUrl: this.baseUrl, token: this.token });
      const cassette: Cassette = {
        recordedAt: new Date().toISOString(),
        key,
        request: {
          method: key.method,
          path: key.normalizedPath,
          headers: sanitizeHeaders(request.headers),
          ...(key.bodyHash !== undefined ? { bodyHash: key.bodyHash } : {}),
        },
        response: {
          status: upstream.status,
          headers: sanitizeHeaders(upstream.headers),
          body: encodeBody(upstream.headers, upstream.body),
        },
      };
      this.store.write(cassette);
      return {
        status: upstream.status,
        headers: cassette.response.headers,
        body: decodeBody(cassette.response.body),
        origin: 'recorded',
      };
    } catch (err: any) {
      return {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
        body: { error: err?.message || 'Unable to reach Figma API.' },
        origin: 'error',
      };
    }
  }

  listRoutes(): Record<string, RouteSummary> {
    const routes: Record<string, RouteSummary> = {};
    for (const cassette of this.store.list()) {
      routes[`${cassette.key.method.toLowerCase()} ${cassette.key.normalizedPath}`] = {
        status: cassette.response.status,
        source: 'figma-cassette',
      };
    }
    return routes;
  }
}

export function listFigmaCassettes(cassetteDir?: string): Record<string, RouteSummary> {
  const opts: FigmaProxyOptions = cassetteDir !== undefined
    ? { mode: 'replay', cassetteDir }
    : { mode: 'replay' };
  return new FigmaProxyAdapter(opts).listRoutes();
}

export function clearFigmaCassettes(cassetteDir?: string): number {
  return new CassetteStore(cassetteDir || DEFAULT_FIGMA_CASSETTE_DIR).clear();
}

function fetchFromFigma(request: AdapterRequest, options: Required<Pick<FigmaProxyOptions, 'baseUrl'>> & Pick<FigmaProxyOptions, 'token'>): Promise<FigmaFetchedResponse> {
  return new Promise((resolve, reject) => {
    const upstream = new URL(request.url, options.baseUrl);
    const headers = sanitizeHeaders(request.headers);
    headers['X-Figma-Token'] = options.token || '';
    delete headers.host;
    delete headers.Host;

    const req = https.request(upstream, {
      method: request.method.toUpperCase(),
      headers,
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          headers: res.headers as Record<string, any>,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    if (request.body) req.write(request.body);
    req.end();
  });
}
