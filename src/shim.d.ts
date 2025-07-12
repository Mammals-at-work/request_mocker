declare var __dirname: string;
declare var process: any;


declare module 'fs' {
  export function readFileSync(path: string, enc: string): string;
}

declare module 'http' {
  export interface Server {
    listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, hostname?: string, listeningListener?: () => void): this;
    listen(port?: number, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, listeningListener?: () => void): this;
    listen(path: string, backlog?: number, listeningListener?: () => void): this;
    listen(path: string, listeningListener?: () => void): this;
    listen(options: any, listeningListener?: () => void): this;
    close(): this;
  }
  export function createServer(handler: any): Server;
}

interface Api {
  selectFile: () => Promise<string>;

  selectDataFile: () => Promise<string>;
  startServer: (file: string, port: number, data?: string) => Promise<boolean>;
  stopServer: () => Promise<boolean>;
  listRoutes: (file: string) => Promise<any>;
  getLogs: () => Promise<any>;
  clearLogs: () => Promise<void>;
}

interface Window {
  api: Api;
}
