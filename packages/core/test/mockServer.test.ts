import path from 'path';
import http from 'http';
import { startServer, type MockServerHandle } from '../src/mockServer';

const specs = [
  path.join(__dirname, '..', 'fixtures', 'sample_api.yaml'),
  path.join(__dirname, '..', 'fixtures', 'sample_api.json'),
];
const dataFile = path.join(__dirname, '..', 'fixtures', 'sample_data.json');

function waitForListening(handle: MockServerHandle): Promise<number> {
  return new Promise((resolve, reject) => {
    handle.server.once('listening', () => {
      const addr = handle.server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
    handle.server.once('error', reject);
  });
}

function get(port: number, route: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${route}`, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    }).on('error', reject);
  });
}

function post(port: number, route: string, payload = ''): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method: 'POST',
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': payload.length,
            }
          : undefined,
      },
      res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe.each(specs)('mock server responses %s', spec => {
  test('GET /hello returns sample message', async () => {
    const handle = startServer(spec, 0);
    const port = await waitForListening(handle);

    const response = await get(port, '/hello');

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'Hello World' });
    await handle.close();
  });

  test('POST /echo returns echo message', async () => {
    const handle = startServer(spec, 0);
    const port = await waitForListening(handle);

    const response = await post(port, '/echo', JSON.stringify({}));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ message: 'Received' });
    await handle.close();
  });

  test('returns 404 for unknown route', async () => {
    const handle = startServer(spec, 0);
    const port = await waitForListening(handle);

    const response = await get(port, '/missing');

    expect(response.status).toBe(404);
    await handle.close();
  });

  test('logs incoming requests', async () => {
    const handle = startServer(spec, 0);
    const port = await waitForListening(handle);
    handle.clearLogs();

    await get(port, '/hello');

    const logs = handle.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].request!.method).toBe('GET');
    expect(logs[0].request!.path).toBe('/hello');
    expect(logs[0].response!.origin).toBe('openapi');
    await handle.close();
  });
});

describe.each(specs)('mock server responses with data file %s', spec => {
  test('GET /hello returns overridden message', async () => {
    const handle = startServer(spec, 0, dataFile);
    const port = await waitForListening(handle);

    const response = await get(port, '/hello');

    expect(JSON.parse(response.body)).toEqual({ message: 'Hola Mundo' });
    await handle.close();
  });

  test('POST /echo uses custom status', async () => {
    const handle = startServer(spec, 0, dataFile);
    const port = await waitForListening(handle);

    const response = await post(port, '/echo');

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ message: 'Custom' });
    await handle.close();
  });
});
