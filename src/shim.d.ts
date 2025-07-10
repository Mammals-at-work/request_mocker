declare var __dirname: string;
declare var process: any;

declare module 'electron' {
  export const app: any;
  export class BrowserWindow {
    constructor(opts?: any);
    loadFile(path: string): void;
    static getAllWindows(): BrowserWindow[];
  }
  export const ipcMain: any;
  export const dialog: any;
  export const contextBridge: any;
  export const ipcRenderer: any;
}

declare module 'path' {
  const mod: any;
  export = mod;
}

declare module 'fs' {
  export function readFileSync(path: string, enc: string): string;
}

declare module 'http' {
  export interface Server {
    listen(port: number, host?: string): void;
    close(): void;
  }
  export function createServer(handler: any): Server;
}

interface API {
  selectFile: () => Promise<string | null>;
  selectDataFile: () => Promise<string | null>;
  startServer: (file: string, port: number, data?: string) => Promise<boolean>;
  stopServer: () => Promise<boolean>;
  listRoutes: (file: string, data?: string) => Promise<Record<string, any> | null>;
}

interface Window {
  api: API;
}
