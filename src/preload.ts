import { contextBridge, ipcRenderer } from 'electron';
import { setServerDelay } from './mockServer';

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectDataFile: () => ipcRenderer.invoke('select-data-file'),
  startServer: (file: string, port: number, data?: string) => ipcRenderer.invoke('start-server', file, port, data),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  listRoutes: (file: string, data?: string) => ipcRenderer.invoke('list-routes', file, data),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  setServerDelay: (delay: number) => {
    setServerDelay(delay);
  }
});
