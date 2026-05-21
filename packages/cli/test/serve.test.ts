import path from 'path';
import request from 'supertest';
import { serve } from '../src/serve';
import type { MockServerHandle } from '@request-mocker/core';

const specPath = path.join(__dirname, '..', '..', 'core', 'fixtures', 'sample_api.yaml');

describe('cli serve', () => {
  let handle: MockServerHandle;

  afterEach(async () => {
    if (handle) await handle.close();
  });

  test('serves openapi route end-to-end', async () => {
    const result = await serve({ mode: 'openapi', port: 0, spec: specPath, logLevel: 'silent' });
    handle = result.handle;
    const res = await request(handle.server).get('/hello');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hello World' });
  });

  test('exposes /__mock__/health and /__mock__/metrics', async () => {
    const result = await serve({ mode: 'openapi', port: 0, spec: specPath, logLevel: 'silent' });
    handle = result.handle;
    const health = await request(handle.server).get('/__mock__/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    await request(handle.server).get('/hello');
    const metrics = await request(handle.server).get('/__mock__/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('mock_requests_total');
  });

  test('rejects openapi mode without --spec', async () => {
    await expect(serve({ mode: 'openapi', port: 0, logLevel: 'silent' })).rejects.toMatchObject({
      exitCode: 10,
    });
  });
});
