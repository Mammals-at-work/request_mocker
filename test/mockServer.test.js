const path = require('path');
const http = require('http');
const { startServer, getLogs, clearLogs } = require('../dist/mockServer.js');

describe('mock server responses', () => {
  const spec = path.join(__dirname, '..', 'sample_api.yaml');
  let port = 9001;

  test('GET /hello returns sample message', done => {
    const server = startServer(spec, port++);
    http.get(`http://localhost:${server.address().port}/hello`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(data)).toEqual({ message: 'Hello World' });
        server.close();
        done();
      });
    });
  });

  test('POST /echo returns echo message', done => {
    const server = startServer(spec, port++);
    const payload = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost',
      port: server.address().port,
      path: '/echo',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(body)).toEqual({ message: 'Received' });
        server.close();
        done();
      });
    });
    req.write(payload);
    req.end();
  });

  test('returns 404 for unknown route', done => {
    const server = startServer(spec, port++);
    http.get(`http://localhost:${server.address().port}/missing`, res => {
      expect(res.statusCode).toBe(404);
      server.close();
      done();
    });
  });

  test('logs incoming requests', done => {
    const server = startServer(spec, port++);
    clearLogs();
    http.get(`http://localhost:${server.address().port}/hello`, () => {
      const logs = getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].method).toBe('GET');
      expect(logs[0].path).toBe('/hello');
      server.close();
      done();
    });
  });
});
