import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import {
  clearFigmaCassettes,
  FIGMA_API_BASE_URL,
  FIGMA_ASSET_PATH_PREFIX,
  FigmaProxyAdapter,
} from '../src/adapters/figmaProxyAdapter';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'request-mocker-figma-'));
}

test('record mode calls upstream and stores a sanitized cassette', async () => {
  const cassetteDir = tmpDir();
  const fetcher = jest.fn(async () => ({
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'secret=true',
    },
    body: Buffer.from(JSON.stringify({ name: 'Recorded file' })),
  }));
  const adapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher,
  });

  const response = await adapter.handle({
    method: 'GET',
    url: '/v1/files/abc?b=2&a=1',
    headers: {
      Authorization: 'Bearer user-secret',
      'Content-Type': 'application/json',
    },
  });

  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(response.origin).toBe('recorded');
  expect(response.body).toEqual({ name: 'Recorded file' });

  const cassetteFile = fs.readdirSync(cassetteDir)[0];
  const cassette = JSON.parse(fs.readFileSync(path.join(cassetteDir, cassetteFile), 'utf8'));
  expect(cassette.request.headers.Authorization).toBeUndefined();
  expect(cassette.response.headers['Set-Cookie']).toBeUndefined();
  expect(cassette.key.normalizedPath).toBe('/v1/files/abc?a=1&b=2');
});

test('replay mode returns cassette without calling upstream', async () => {
  const cassetteDir = tmpDir();
  const recordFetcher = jest.fn(async () => ({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.from(JSON.stringify({ name: 'Replay me' })),
  }));
  const recordAdapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: recordFetcher,
  });
  await recordAdapter.handle({ method: 'GET', url: '/v1/files/abc', headers: {} });

  const replayFetcher = jest.fn();
  const replayAdapter = new FigmaProxyAdapter({
    mode: 'replay',
    cassetteDir,
    fetcher: replayFetcher,
  });
  const response = await replayAdapter.handle({ method: 'GET', url: '/v1/files/abc', headers: {} });

  expect(replayFetcher).not.toHaveBeenCalled();
  expect(response.origin).toBe('replayed');
  expect(response.body).toEqual({ name: 'Replay me' });
});

test('replay mode returns explicit miss when cassette is missing', async () => {
  const replayAdapter = new FigmaProxyAdapter({
    mode: 'replay',
    cassetteDir: tmpDir(),
    fetcher: jest.fn(),
  });

  const response = await replayAdapter.handle({ method: 'GET', url: '/v1/files/missing', headers: {} });

  expect(response.status).toBe(502);
  expect(response.origin).toBe('miss');
  expect((response.body as any).error).toContain('No recorded Figma cassette');
});

test('record mode stores upstream error statuses', async () => {
  const cassetteDir = tmpDir();
  const adapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 429,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ err: 'rate limited' })),
    })),
  });

  const response = await adapter.handle({ method: 'GET', url: '/v1/files/abc', headers: {} });

  expect(response.status).toBe(429);
  expect(response.origin).toBe('recorded');
  expect(response.body).toEqual({ err: 'rate limited' });
  expect(fs.readdirSync(cassetteDir)).toHaveLength(1);
});

test('record mode uses the Figma API host and personal access token header', async () => {
  const cassetteDir = tmpDir();
  let capturedUrl: URL | undefined;
  let capturedOptions: https.RequestOptions | undefined;
  const requestSpy = jest.spyOn(https, 'request').mockImplementation((url: any, options: any, callback: any): any => {
    capturedUrl = url;
    capturedOptions = options;

    const req = new PassThrough();
    const res = new PassThrough() as any;
    res.statusCode = 200;
    res.headers = { 'Content-Type': 'application/json' };

    process.nextTick(() => {
      callback(res);
      res.end(JSON.stringify({ ok: true }));
    });

    return req;
  });

  try {
    const adapter = new FigmaProxyAdapter({
      mode: 'record',
      token: 'secret-token',
      cassetteDir,
    });

    const response = await adapter.handle({
      method: 'GET',
      url: '/v1/files/abc?foo=bar',
      headers: {
        Authorization: 'Bearer wrong-header',
        host: 'localhost:8000',
      },
    });

    expect(response.origin).toBe('recorded');
    expect(capturedUrl?.toString()).toBe(`${FIGMA_API_BASE_URL}v1/files/abc?foo=bar`);
    expect(capturedOptions?.headers).toMatchObject({ 'X-Figma-Token': 'secret-token' });
    expect((capturedOptions?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((capturedOptions?.headers as Record<string, string>).host).toBeUndefined();
  } finally {
    requestSpy.mockRestore();
  }
});

test('record mode downloads png assets from Figma image responses', async () => {
  const cassetteDir = tmpDir();
  const png = Buffer.from('png-bytes');
  const adapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          '7:13519': 'https://s3-alpha.figma.com/rendered-node.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'image/png' },
      body: png,
    })),
  });

  const response = await adapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });

  expect(response.origin).toBe('recorded');
  const cassetteFile = fs.readdirSync(cassetteDir).find(file => file.endsWith('.json'));
  expect(cassetteFile).toBeDefined();
  const cassette = JSON.parse(fs.readFileSync(path.join(cassetteDir, cassetteFile as string), 'utf8'));
  expect(cassette.assets.images['7:13519']).toMatchObject({
    path: `assets/${cassette.key.hash}_7_13519.png`,
    contentType: 'image/png',
    bytes: png.length,
  });
  expect(fs.readFileSync(path.join(cassetteDir, cassette.assets.images['7:13519'].path))).toEqual(png);
});

test('replay mode rewrites recorded Figma image urls to local asset urls', async () => {
  const cassetteDir = tmpDir();
  const recordAdapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          '7:13519': 'https://s3-alpha.figma.com/rendered-node.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from('png-bytes'),
    })),
  });
  await recordAdapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });

  const replayAdapter = new FigmaProxyAdapter({ mode: 'replay', cassetteDir });
  const response = await replayAdapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });

  expect(response.origin).toBe('replayed');
  expect((response.body as any).images['7:13519']).toMatch(/^http:\/\/localhost:8000\/__mock__\/figma-assets\/.+\.png$/);
});

test('replay mode serves local png assets', async () => {
  const cassetteDir = tmpDir();
  const recordAdapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          '7:13519': 'https://s3-alpha.figma.com/rendered-node.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from('png-bytes'),
    })),
  });
  const recorded = await recordAdapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });
  expect(recorded.origin).toBe('recorded');

  const replayAdapter = new FigmaProxyAdapter({ mode: 'replay', cassetteDir });
  const assetResponse = await replayAdapter.handle({
    method: 'GET',
    url: `${FIGMA_ASSET_PATH_PREFIX}GET_${'unused'}.png`,
    headers: {},
  });
  expect(assetResponse.status).toBe(404);

  const cassetteFile = fs.readdirSync(cassetteDir).find(file => file.endsWith('.json')) as string;
  const cassette = JSON.parse(fs.readFileSync(path.join(cassetteDir, cassetteFile), 'utf8'));
  const fileName = path.basename(cassette.assets.images['7:13519'].path);
  const response = await replayAdapter.handle({
    method: 'GET',
    url: `${FIGMA_ASSET_PATH_PREFIX}${encodeURIComponent(fileName)}`,
    headers: {},
  });

  expect(response.status).toBe(200);
  expect(response.headers).toEqual({ 'Content-Type': 'image/png' });
  expect(response.body).toEqual(Buffer.from('png-bytes'));
});

test('record mode keeps image cassette when one png download fails', async () => {
  const cassetteDir = tmpDir();
  const adapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          ok: 'https://s3-alpha.figma.com/ok.png',
          broken: 'https://s3-alpha.figma.com/broken.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async (url: string) => {
      if (url.includes('broken')) throw new Error('download failed');
      return {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        body: Buffer.from('ok-png'),
      };
    }),
  });

  const response = await adapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=ok,broken&format=png',
    headers: {},
  });

  expect(response.origin).toBe('recorded');
  const cassetteFile = fs.readdirSync(cassetteDir).find(file => file.endsWith('.json')) as string;
  const cassette = JSON.parse(fs.readFileSync(path.join(cassetteDir, cassetteFile), 'utf8'));
  expect(cassette.assets.images.ok).toBeDefined();
  expect(cassette.assets.images.broken).toBeUndefined();
  expect(cassette.response.body.value.images.broken).toBe('https://s3-alpha.figma.com/broken.png');
});

test('replay mode preserves old image cassettes without asset metadata', async () => {
  const cassetteDir = tmpDir();
  const recordAdapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          '7:13519': 'https://s3-alpha.figma.com/rendered-node.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async () => {
      throw new Error('download failed');
    }),
  });
  await recordAdapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });

  const replayAdapter = new FigmaProxyAdapter({ mode: 'replay', cassetteDir });
  const response = await replayAdapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: { host: 'localhost:8000' },
  });

  expect((response.body as any).images['7:13519']).toBe('https://s3-alpha.figma.com/rendered-node.png');
});

test('clearFigmaCassettes removes cassette json files and png assets', async () => {
  const cassetteDir = tmpDir();
  const adapter = new FigmaProxyAdapter({
    mode: 'record',
    token: 'secret-token',
    cassetteDir,
    fetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        images: {
          '7:13519': 'https://s3-alpha.figma.com/rendered-node.png',
        },
      })),
    })),
    assetFetcher: jest.fn(async () => ({
      status: 200,
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from('png-bytes'),
    })),
  });
  await adapter.handle({
    method: 'GET',
    url: '/v1/images/file-key?ids=7%3A13519&format=png',
    headers: {},
  });

  expect(fs.readdirSync(cassetteDir).some(file => file.endsWith('.json'))).toBe(true);
  expect(fs.existsSync(path.join(cassetteDir, 'assets'))).toBe(true);
  const removed = clearFigmaCassettes(cassetteDir);

  expect(removed).toBe(2);
  expect(fs.readdirSync(cassetteDir).filter(file => file.endsWith('.json'))).toHaveLength(0);
  expect(fs.existsSync(path.join(cassetteDir, 'assets'))).toBe(false);
});
