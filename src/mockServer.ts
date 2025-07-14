// --- Latency simulation ---
let serverDelay = 0;
export function setServerDelay(ms: number) {
  serverDelay = ms;
}

import http from 'http';
import { YAMLObject } from './simpleYaml';
import { loadSpecFile } from './specLoader';
import { getOverride } from './db';

let logs: LogEntry[] = [];

export interface LogEntry {
  data: LogEntryData;
  request: LogEntryRequest;
  response: LogEntryResponse;
  system?: LogSystem;
} 

export interface LogEntryData {
  timestamp: number;
  responseTime: number;
};

export interface LogSystem { 
  msg: string 
};



export interface LogEntryRequest {
  method: string;
  path: string;
  headers: Record<string, any>;
  body?: string;
// --- Latency simulation ---


}

export interface LogEntryResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
}

// --- Latency simulation ---

export interface Route {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export function buildRoutes(spec: YAMLObject): Record<string, Route> {
  const routes: Record<string, Route> = {};
  const paths = spec.paths as YAMLObject | undefined;
  if (!paths) return routes;
  for (const path of Object.keys(paths)) {
    const methods = (paths[path] as YAMLObject) || {};
    for (const method of Object.keys(methods)) {
      const detail = methods[method] as YAMLObject;
      const responses = (detail.responses as YAMLObject) || {};
      let resp: YAMLObject | undefined;
      if (responses['200']) resp = responses['200'] as YAMLObject;
      else if (Object.keys(responses).length) resp = responses[Object.keys(responses)[0]] as YAMLObject;
      const content = (resp?.content as YAMLObject) || {};
      let body: any = {};
      if (content['application/json']) {
        const example = (content['application/json'] as YAMLObject).example;
        if (example !== undefined) body = example;
      } else if (content['text/plain']) {
        const example = (content['text/plain'] as YAMLObject).example;
        if (example !== undefined) body = example;
      }
      routes[`${method.toLowerCase()} ${path}`] = {
        status: resp ? parseInt(Object.keys(responses)[0], 10) || 200 : 200,
        body,
      };
    }
  }
  return routes;
}

export function startServer(specPath: string, port: number, dataPath?: string): http.Server {
  const spec = loadSpecFile(specPath) as YAMLObject;
  const routes = buildRoutes(spec);
  if (dataPath) {
    const overrides = loadSpecFile(dataPath) as YAMLObject;
    for (const key of Object.keys(overrides)) {
      const val: any = (overrides as YAMLObject)[key];
      if (routes[key]) {
        if (val && typeof val === 'object' && 'body' in val) {
          routes[key].body = (val as any).body;
          if ((val as any).status) routes[key].status = (val as any).status;
        } else {
          routes[key].body = val;
        }
      } else {
        let body: any;
        let status = 200;
        if (val && typeof val === 'object' && 'body' in val) {
          body = (val as any).body;
          if ((val as any).status) status = (val as any).status;
        } else {
          body = val;
        }
        routes[key] = { status, body };
      }
    }
  }

  logs = [];
  let bodyStr = '';
  const server = http.createServer((req, res) => {
    // Helper to send the response (with simulated delay)
    function sendResponse(status: number, body: any) {
      setTimeout(() => {
        res.statusCode = status;
        if (typeof body === 'object') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        } else {
          res.end(String(body));
        }
        printLogsRequest(req, res);
      }, serverDelay);
    }
    if (!req.url || !req.method) {
      sendResponse(404, 'Not Found');
      return;
    }
    bodyStr = '';
    req.on('data', c => bodyStr += c);
    req.on('end', () => {
      const key = `${req.method!.toLowerCase()} ${req.url!}`;
      const route = routes[key];
      if (!route) {
        sendResponse(404, 'Not Found');
        return;
      }
      // Check for DB override
      const [method, endpoint] = [req.method!.toLowerCase(), req.url!];
      getOverride(method, endpoint, route.status, (err, row) => {
        if (!err && row && row.body) {
          let overrideBody;
          try { overrideBody = JSON.parse(row.body); } catch { overrideBody = row.body; }
          sendResponse(row.status, overrideBody);
        } else {
          sendResponse(route.status, route.body);
        }
      });
    });
  });
  server.listen(port, 'localhost');

  server.on('error', (err) => {
    printLogSystem(`[ SYSTEM ] Server error: ${err.message}`);
    console.error('Server error:', err);
  });

  server.on('listen', (err) => {
    printLogSystem(`[ SYSTEM ] Server Listening on: http://localhost:${port}`);
  });
  return server;

  function printLogsRequest(req: any, res: any){
    logs.unshift({ 
      data: {
        timestamp: Date.now(),
        responseTime: res.socket?.endTime ? res.socket.endTime - req.socket.startTime : 0,
      },
      request: {
        method: req.method!,
        path: req.url!,
        headers: req.headers,
        body: req.body ? req.body.toString() : '',
      }, response: {
        status: res.statusCode,
        headers: res.getHeaders() as Record<string, string>,
        body: res.body ? res.body.toString() : '',}
      });
  }

  function printLogSystem(msg: string){
    logs.push({
      data: { timestamp: Date.now(), responseTime: 0 },
      request: undefined, 
      response: undefined, 
      system: { msg }});
  }
}

export function extractRoutes(specPath: string, dataPath?: string): Record<string, Route> {
  const spec = loadSpecFile(specPath) as YAMLObject;
  const routes = buildRoutes(spec);
  if (dataPath) {
    const overrides = loadSpecFile(dataPath) as YAMLObject;
    for (const key of Object.keys(overrides)) {
      const val: any = (overrides as YAMLObject)[key];
      if (routes[key]) {
        if (val && typeof val === 'object' && 'body' in val) {
          routes[key].body = (val as any).body;
          if ((val as any).status) routes[key].status = (val as any).status;
        } else {
          routes[key].body = val;
        }
      } else {
        let body: any;
        let status = 200;
        if (val && typeof val === 'object' && 'body' in val) {
          body = (val as any).body;
          if ((val as any).status) status = (val as any).status;
        } else {
          body = val;
        }
        routes[key] = { status, body };
      }
    }
  }

  return routes;
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs = [];
}
