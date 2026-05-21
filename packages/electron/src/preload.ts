import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectDataFile: () => ipcRenderer.invoke('select-data-file'),
  startServer: (file: string, port: number, data?: string) => ipcRenderer.invoke('start-server', file, port, data),
  startFigmaServer: (options: { port: number; mode: 'record' | 'replay'; token?: string; cassetteDir?: string }) => ipcRenderer.invoke('start-figma-server', options),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  listRoutes: (file: string, data?: string) => ipcRenderer.invoke('list-routes', file, data),
  listFigmaRoutes: (cassetteDir?: string) => ipcRenderer.invoke('list-figma-routes', cassetteDir),
  clearFigmaCassettes: (cassetteDir?: string) => ipcRenderer.invoke('clear-figma-cassettes', cassetteDir),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  setServerDelay: (delay: number) => ipcRenderer.invoke('set-server-delay', delay),
});
