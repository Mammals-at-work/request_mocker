import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
  'x-figma-token',
]);

export const DEFAULT_FIGMA_CASSETTE_DIR = path.resolve(process.cwd(), 'mock-cassettes', 'figma');

export interface CassetteKey {
  method: string;
  normalizedPath: string;
  bodyHash?: string;
  hash: string;
}

export interface StoredBody {
  encoding: 'json' | 'text' | 'base64';
  value: any;
}

export interface Cassette {
  recordedAt: string;
  key: CassetteKey;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    bodyHash?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: StoredBody;
  };
  assets?: CassetteAssets;
}

export interface CassetteAsset {
  path: string;
  contentType: string;
  bytes: number;
  sourceUrlHash: string;
}

export interface CassetteAssets {
  images?: Record<string, CassetteAsset>;
}

export function sanitizeHeaders(headers: Record<string, any> = {}): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const rawName of Object.keys(headers)) {
    const name = rawName.toLowerCase();
    if (SENSITIVE_HEADERS.has(name)) continue;
    const value = headers[rawName];
    if (Array.isArray(value)) {
      safe[rawName] = value.join(', ');
    } else if (value !== undefined) {
      safe[rawName] = String(value);
    }
  }
  return safe;
}

export function buildCassetteKey(method: string, rawUrl: string, body = ''): CassetteKey {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizeRequestPath(rawUrl);
  const bodyHash = shouldHashBody(normalizedMethod) ? sha256(body) : undefined;
  const hash = sha256([normalizedMethod, normalizedPath, bodyHash || ''].join('\n')).slice(0, 24);
  const key: CassetteKey = { method: normalizedMethod, normalizedPath, hash };
  if (bodyHash !== undefined) key.bodyHash = bodyHash;
  return key;
}

export function encodeBody(headers: Record<string, any>, body: Buffer): StoredBody {
  const contentType = getHeader(headers, 'content-type');
  const text = body.toString('utf8');

  if (contentType.includes('application/json')) {
    try {
      return { encoding: 'json', value: JSON.parse(text) };
    } catch {
      return { encoding: 'text', value: text };
    }
  }

  if (isTextContent(contentType)) {
    return { encoding: 'text', value: text };
  }

  return { encoding: 'base64', value: body.toString('base64') };
}

export function decodeBody(stored: StoredBody): any {
  if (stored.encoding === 'base64') return Buffer.from(String(stored.value), 'base64');
  return stored.value;
}

export class CassetteStore {
  constructor(private readonly dir: string = DEFAULT_FIGMA_CASSETTE_DIR) {}

  get directory(): string {
    return this.dir;
  }

  list(): Cassette[] {
    if (!fs.existsSync(this.dir)) return [];
    return fs.readdirSync(this.dir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .map(file => this.readFile(path.join(this.dir, file)))
      .filter(Boolean) as Cassette[];
  }

  read(key: CassetteKey): Cassette | null {
    const filePath = this.filePath(key);
    if (!fs.existsSync(filePath)) return null;
    return this.readFile(filePath);
  }

  write(cassette: Cassette): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath(cassette.key), JSON.stringify(cassette, null, 2));
  }

  clear(): number {
    if (!fs.existsSync(this.dir)) return 0;
    let removed = 0;
    for (const file of fs.readdirSync(this.dir)) {
      if (!file.endsWith('.json')) continue;
      fs.unlinkSync(path.join(this.dir, file));
      removed += 1;
    }
    removed += new FigmaAssetStore(this.dir).clear();
    return removed;
  }

  private filePath(key: CassetteKey): string {
    return path.join(this.dir, `${key.method}_${key.hash}.json`);
  }

  private readFile(filePath: string): Cassette | null {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Cassette;
    } catch {
      return null;
    }
  }
}

export class FigmaAssetStore {
  private readonly assetsDir: string;

  constructor(private readonly cassetteDir: string = DEFAULT_FIGMA_CASSETTE_DIR) {
    this.assetsDir = path.join(cassetteDir, 'assets');
  }

  get directory(): string {
    return this.assetsDir;
  }

  writeImage(args: {
    cassetteHash: string;
    nodeId: string;
    sourceUrl: string;
    contentType: string;
    body: Buffer;
  }): CassetteAsset {
    fs.mkdirSync(this.assetsDir, { recursive: true });
    const fileName = `${args.cassetteHash}_${sanitizeAssetName(args.nodeId)}.png`;
    fs.writeFileSync(path.join(this.assetsDir, fileName), args.body);
    return {
      path: `assets/${fileName}`,
      contentType: args.contentType || 'image/png',
      bytes: args.body.length,
      sourceUrlHash: sha256(args.sourceUrl),
    };
  }

  read(relativePathOrFileName: string): { body: Buffer; contentType: string } | null {
    const fileName = path.basename(relativePathOrFileName);
    if (!isSafeAssetFileName(fileName)) return null;
    const filePath = path.join(this.assetsDir, fileName);
    if (!fs.existsSync(filePath)) return null;
    return {
      body: fs.readFileSync(filePath),
      contentType: 'image/png',
    };
  }

  clear(): number {
    if (!fs.existsSync(this.assetsDir)) return 0;
    let removed = 0;
    for (const file of fs.readdirSync(this.assetsDir)) {
      if (!file.endsWith('.png')) continue;
      fs.unlinkSync(path.join(this.assetsDir, file));
      removed += 1;
    }
    try {
      fs.rmdirSync(this.assetsDir);
    } catch {
      // Leave the directory if it still contains user-created files.
    }
    return removed;
  }
}

function normalizeRequestPath(rawUrl: string): string {
  const url = new URL(rawUrl, 'http://localhost');
  const params = Array.from(url.searchParams.entries())
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  const query = new URLSearchParams(params).toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function shouldHashBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sanitizeAssetName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'node';
}

function isSafeAssetFileName(value: string): boolean {
  return /^[a-zA-Z0-9._-]+\.png$/.test(value);
}

function getHeader(headers: Record<string, any>, headerName: string): string {
  const found = Object.keys(headers).find(name => name.toLowerCase() === headerName);
  return found ? String(headers[found]).toLowerCase() : '';
}

function isTextContent(contentType: string): boolean {
  return contentType.startsWith('text/')
    || contentType.includes('application/xml')
    || contentType.includes('application/javascript')
    || contentType.includes('image/svg+xml');
}
