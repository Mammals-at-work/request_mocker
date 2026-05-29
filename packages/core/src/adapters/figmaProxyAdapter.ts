import https from 'https';
import {
  buildCassetteKey,
  Cassette,
  CassetteStore,
  decodeBody,
  DEFAULT_FIGMA_CASSETTE_DIR,
  encodeBody,
  FigmaAssetStore,
  sanitizeHeaders,
} from './cassetteStore';
import { AdapterRequest, AdapterResponse, MockAdapter, RouteSummary } from './types';

export type FigmaProxyMode = 'record' | 'replay';
export const FIGMA_API_BASE_URL = 'https://api.figma.com/';
export const FIGMA_ASSET_PATH_PREFIX = '/__mock__/figma-assets/';

export interface FigmaProxyOptions {
  mode: FigmaProxyMode;
  token?: string;
  cassetteDir?: string;
  baseUrl?: string;
  fetcher?: FigmaFetcher;
  assetFetcher?: FigmaAssetFetcher;
}

export interface FigmaFetchedResponse {
  status: number;
  headers: Record<string, any>;
  body: Buffer;
}

export type FigmaFetcher = (request: AdapterRequest, options: Required<Pick<FigmaProxyOptions, 'baseUrl'>> & Pick<FigmaProxyOptions, 'token'>) => Promise<FigmaFetchedResponse>;
export type FigmaAssetFetcher = (url: string) => Promise<FigmaFetchedResponse>;

export class FigmaProxyAdapter implements MockAdapter {
  readonly id = 'figma-proxy';
  readonly name = 'Figma Proxy';
  private readonly mode: FigmaProxyMode;
  private readonly token?: string;
  private readonly baseUrl: string;
  private readonly store: CassetteStore;
  private readonly assetStore: FigmaAssetStore;
  private readonly fetcher: FigmaFetcher;
  private readonly assetFetcher: FigmaAssetFetcher;

  constructor(options: FigmaProxyOptions) {
    this.mode = options.mode;
    if (options.token !== undefined) this.token = options.token;
    this.baseUrl = options.baseUrl || FIGMA_API_BASE_URL;
    const cassetteDir = options.cassetteDir || DEFAULT_FIGMA_CASSETTE_DIR;
    this.store = new CassetteStore(cassetteDir);
    this.assetStore = new FigmaAssetStore(cassetteDir);
    this.fetcher = options.fetcher || fetchFromFigma;
    this.assetFetcher = options.assetFetcher || fetchAsset;
  }

  match(request: AdapterRequest): boolean {
    return request.url.startsWith('/v1/')
      || request.url.startsWith('/v2/')
      || request.url.startsWith(FIGMA_ASSET_PATH_PREFIX);
  }

  async handle(request: AdapterRequest): Promise<AdapterResponse> {
    if (isLocalAssetRequest(request)) {
      return this.handleAssetRequest(request);
    }

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
      const body = rewriteFigmaImageUrls(decodeBody(cassette.response.body), cassette, request);
      return {
        status: cassette.response.status,
        headers: cassette.response.headers,
        body,
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
      await this.capturePngAssets(request, upstream, cassette);
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

  private handleAssetRequest(request: AdapterRequest): AdapterResponse {
    if (request.method.toUpperCase() !== 'GET') {
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Figma assets can only be read with GET.' },
        origin: 'miss',
      };
    }

    const fileName = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice(FIGMA_ASSET_PATH_PREFIX.length));
    const asset = this.assetStore.read(fileName);
    if (!asset) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Figma asset not found.' },
        origin: 'miss',
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': asset.contentType },
      body: asset.body,
      origin: 'replayed',
    };
  }

  private async capturePngAssets(request: AdapterRequest, upstream: FigmaFetchedResponse, cassette: Cassette): Promise<void> {
    if (!shouldCapturePngAssets(request, upstream.status)) return;

    const body = decodeBody(cassette.response.body);
    const images = body && typeof body === 'object' ? (body as any).images : undefined;
    if (!images || typeof images !== 'object' || Array.isArray(images)) return;

    for (const nodeId of Object.keys(images)) {
      const sourceUrl = images[nodeId];
      if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) continue;

      try {
        const image = await this.assetFetcher(sourceUrl);
        if (image.status < 200 || image.status >= 300 || image.body.length === 0) continue;
        const asset = this.assetStore.writeImage({
          cassetteHash: cassette.key.hash,
          nodeId,
          sourceUrl,
          contentType: resolveHeader(image.headers, 'content-type') || 'image/png',
          body: image.body,
        });
        cassette.assets = cassette.assets || {};
        cassette.assets.images = cassette.assets.images || {};
        cassette.assets.images[nodeId] = asset;
      } catch {
        // Keep the JSON cassette even if an individual exported image cannot be downloaded.
      }
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

function fetchAsset(url: string): Promise<FigmaFetchedResponse> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          headers: res.headers as Record<string, any>,
          body: Buffer.concat(chunks),
        });
      });
    }).on('error', reject);
  });
}

function isLocalAssetRequest(request: AdapterRequest): boolean {
  return request.url.startsWith(FIGMA_ASSET_PATH_PREFIX);
}

function shouldCapturePngAssets(request: AdapterRequest, upstreamStatus: number): boolean {
  if (request.method.toUpperCase() !== 'GET') return false;
  if (upstreamStatus < 200 || upstreamStatus >= 300) return false;
  const url = new URL(request.url, 'http://localhost');
  return url.pathname.startsWith('/v1/images/')
    && url.searchParams.get('format')?.toLowerCase() === 'png';
}

function rewriteFigmaImageUrls(body: unknown, cassette: Cassette, request: AdapterRequest): unknown {
  const images = cassette.assets?.images;
  if (!images || !body || typeof body !== 'object' || Array.isArray(body)) return body;
  const originalImages = (body as any).images;
  if (!originalImages || typeof originalImages !== 'object' || Array.isArray(originalImages)) return body;

  const rewritten = {
    ...(body as Record<string, unknown>),
    images: { ...originalImages },
  };
  for (const nodeId of Object.keys(images)) {
    const asset = images[nodeId];
    if (!asset) continue;
    if (typeof rewritten.images[nodeId] !== 'string') continue;
    rewritten.images[nodeId] = localAssetUrl(request, asset.path);
  }
  return rewritten;
}

function localAssetUrl(request: AdapterRequest, assetPath: string): string {
  const host = resolveHost(request.headers) || 'localhost';
  const fileName = assetPath.split(/[\\/]/).pop() || assetPath;
  return `http://${host}${FIGMA_ASSET_PATH_PREFIX}${encodeURIComponent(fileName)}`;
}

function resolveHost(headers: AdapterRequest['headers']): string | undefined {
  const host = (headers as Record<string, any>).host ?? (headers as Record<string, any>).Host;
  if (Array.isArray(host)) return host[0];
  return typeof host === 'string' && host.length > 0 ? host : undefined;
}

function resolveHeader(headers: Record<string, any>, headerName: string): string | undefined {
  const found = Object.keys(headers).find(name => name.toLowerCase() === headerName);
  const value = found ? headers[found] : undefined;
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  return value !== undefined ? String(value) : undefined;
}
