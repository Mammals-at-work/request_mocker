import http from 'http';
import { YAMLObject } from './simpleYaml';
import { loadSpecFile } from './specLoader';

let logs: LogEntry[] = [];

export interface LogEntry {
  request: LogEntryRequest;
  response: LogEntryResponse;
  system?: LogSystem;
} 

export interface LogSystem { 
  msg: string 
};



export interface LogEntryRequest {
  method: string;
  path: string;
  headers: Record<string, any>;
  body?: string;
}

export interface LogEntryResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
}

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
    if (!req.url || !req.method) {
      res.statusCode = 404;
      res.end('Not Found');
      printLogsRequest(req, res);
      return;
    }
    bodyStr = '';
    req.on('data', c => bodyStr += c);
    req.on('end', () => {
      const key = `${req.method!.toLowerCase()} ${req.url!}`;
      const route = routes[key];
      if (!route) {
        res.statusCode = 404;
        res.end('Not Found');
        printLogsRequest(req, res);
        return;
      }
      res.statusCode = route.status;
      if (typeof route.body === 'object') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(route.body));
      } else {
        res.end(String(route.body));
      }
      printLogsRequest(req, res);
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
    logs.push({ request: {
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
    logs.push({ request: undefined, response: undefined, system: { msg }});
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
