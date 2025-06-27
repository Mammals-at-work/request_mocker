import http from 'http';
import { YAMLObject } from './simpleYaml';
import { loadSpecFile } from './specLoader';

let logs: LogEntry[] = [];

export interface LogEntry {
  method: string;
  path: string;
  headers: Record<string, any>;
  body: string;
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

export function startServer(specPath: string, port: number): http.Server {
  const spec = loadSpecFile(specPath) as YAMLObject;
  const routes = buildRoutes(spec);
  logs = [];
  const server = http.createServer((req, res) => {
    if (!req.url || !req.method) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    let bodyStr = '';
    req.on('data', c => bodyStr += c);
    req.on('end', () => {
      logs.push({
        method: req.method!,
        path: req.url!,
        headers: req.headers,
        body: bodyStr,
      });

      const key = `${req.method!.toLowerCase()} ${req.url!}`;
      const route = routes[key];
      if (!route) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      res.statusCode = route.status;
      if (typeof route.body === 'object') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(route.body));
      } else {
        res.end(String(route.body));
      }
    });
  });
  server.listen(port, 'localhost');
  return server;
}

export function extractRoutes(specPath: string): Record<string, Route> {
  const spec = loadSpecFile(specPath) as YAMLObject;
  return buildRoutes(spec);
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs = [];
}
