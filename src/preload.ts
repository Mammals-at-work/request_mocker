import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  startServer: (file: string, port: number) => ipcRenderer.invoke('start-server', file, port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  listRoutes: (file: string) => ipcRenderer.invoke('list-routes', file),
});
