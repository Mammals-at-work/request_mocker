import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildCassetteKey,
  CassetteStore,
  sanitizeHeaders,
} from '../src/adapters/cassetteStore';

test('sanitizes sensitive headers before persisting cassettes', () => {
  const safe = sanitizeHeaders({
    Authorization: 'Bearer secret',
    'X-Figma-Token': 'figma-secret',
    Cookie: 'session=secret',
    'Content-Type': 'application/json',
  });

  expect(safe.Authorization).toBeUndefined();
  expect(safe['X-Figma-Token']).toBeUndefined();
  expect(safe.Cookie).toBeUndefined();
  expect(safe['Content-Type']).toBe('application/json');
});

test('builds the same cassette key for equivalent query strings', () => {
  const a = buildCassetteKey('GET', '/v1/files/abc?b=2&a=1');
  const b = buildCassetteKey('GET', '/v1/files/abc?a=1&b=2');

  expect(a.hash).toBe(b.hash);
  expect(a.normalizedPath).toBe('/v1/files/abc?a=1&b=2');
});

test('includes non-GET request body in cassette key', () => {
  const a = buildCassetteKey('POST', '/v1/files/abc/comments', '{"message":"a"}');
  const b = buildCassetteKey('POST', '/v1/files/abc/comments', '{"message":"b"}');

  expect(a.hash).not.toBe(b.hash);
  expect(a.bodyHash).not.toBe(b.bodyHash);
});

test('stores and lists cassette files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'request-mocker-cassettes-'));
  const store = new CassetteStore(dir);
  const key = buildCassetteKey('GET', '/v1/files/abc');

  store.write({
    recordedAt: '2026-05-21T00:00:00.000Z',
    key,
    request: { method: 'GET', path: '/v1/files/abc', headers: {} },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { encoding: 'json', value: { name: 'Demo' } },
    },
  });

  expect(store.list()).toHaveLength(1);
  expect(store.read(key)!.response.status).toBe(200);
  expect(store.clear()).toBe(1);
});
