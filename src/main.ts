import { app, BrowserWindow, dialog, ipcMain } from 'electron';

import path from 'path';
import { startServer, extractRoutes, getLogs, clearLogs } from './mockServer';

let mainWindow: BrowserWindow;
let server: ReturnType<typeof startServer> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),

    },
  });

  mainWindow.loadFile(path.join(__dirname,  'frontend', 'index.html'));
  console.log('Loading index.html from:', path.join(__dirname, 'frontend', 'index.html'));
  // Añade esta línea para abrir las DevTools automáticamente
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],

    filters: [{ name: 'OpenAPI', extensions: ['yaml', 'yml', 'json'] }],

  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-data-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Data', extensions: ['yaml', 'yml', 'json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('start-server', (_e, file: string, port: number, data?: string) => {
  if (server) return false;
  server = startServer(file, port, data);
  return true;
});

ipcMain.handle('stop-server', () => {
  if (!server) return false;
  server.close();
  server = null;
  return true;
});

ipcMain.handle('list-routes', (_e, file: string, data?: string) => {
  try {
    return extractRoutes(file, data);
  } catch {
    return null;
  }
});

ipcMain.handle('get-logs', () => {
  return getLogs();
});

ipcMain.handle('clear-logs', () => {
  clearLogs();
});
