import path from 'path';
import http from 'http';
import {
  startConfiguredServer,
  createMetrics,
  createSilentLogger,
  type MockServerHandle,
} from '../src';

const specPath = path.join(__dirname, '..', 'fixtures', 'sample_api.yaml');

function waitForListening(handle: MockServerHandle): Promise<number> {
  return new Promise((resolve, reject) => {
    handle.server.once('listening', () => {
      const addr = handle.server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
    handle.server.once('error', reject);
  });
}

function request(
  port: number,
  pathName: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: pathName, headers }, res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, body: data, headers: res.headers }),
        );
      })
      .on('error', reject);
  });
}

describe('observability', () => {
  let handle: MockServerHandle;

  afterEach(async () => {
    if (handle) await handle.close();
  });

  test('serves /__mock__/health with uptime', async () => {
    handle = startConfiguredServer({
      mode: 'openapi',
      specPath,
      port: 0,
      logger: createSilentLogger(),
    });
    const port = await waitForListening(handle);
    const res = await request(port, '/__mock__/health');
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeMs).toBe('number');
  });

  test('serves prometheus metrics when metrics provided', async () => {
    const metrics = createMetrics();
    handle = startConfiguredServer({
      mode: 'openapi',
      specPath,
      port: 0,
      logger: createSilentLogger(),
      metrics,
    });
    const port = await waitForListening(handle);
    await request(port, '/hello');
    const res = await request(port, '/__mock__/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toContain('mock_requests_total');
    expect(res.body).toContain('mock_request_duration_seconds');
  });

  test('echoes incoming x-request-id and emits structured log', async () => {
    handle = startConfiguredServer({
      mode: 'openapi',
      specPath,
      port: 0,
      logger: createSilentLogger(),
    });
    const port = await waitForListening(handle);
    const res = await request(port, '/hello', { 'x-request-id': 'req-test-123' });
    expect(res.headers['x-request-id']).toBe('req-test-123');
    const logs = handle.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.requestId).toBe('req-test-123');
  });

  test('ring buffer caps log size', async () => {
    handle = startConfiguredServer({
      mode: 'openapi',
      specPath,
      port: 0,
      logger: createSilentLogger(),
      logBufferSize: 3,
    });
    const port = await waitForListening(handle);
    for (let i = 0; i < 5; i++) {
      await request(port, '/hello');
    }
    expect(handle.getLogs().length).toBeLessThanOrEqual(3);
  });

  test('disabling internal endpoints returns 404 on /__mock__/health', async () => {
    handle = startConfiguredServer({
      mode: 'openapi',
      specPath,
      port: 0,
      logger: createSilentLogger(),
      internalEndpoints: { enabled: false },
    });
    const port = await waitForListening(handle);
    const res = await request(port, '/__mock__/health');
    expect(res.status).toBe(404);
  });
});
