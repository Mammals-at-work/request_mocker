import fs from 'fs';
import os from 'os';
import path from 'path';
import { FigmaProxyAdapter } from '../src/adapters/figmaProxyAdapter';

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
