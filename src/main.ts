import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { startServer, extractRoutes, getLogs, clearLogs } from './mockServer';


let mainWindow: BrowserWindow | null = null;
let server: ReturnType<typeof startServer> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
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
    filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('start-server', (_e, file: string, port: number) => {
  if (server) return false;
  server = startServer(file, port);
  return true;
});

ipcMain.handle('stop-server', () => {
  if (!server) return false;
  server.close();
  server = null;
  return true;
});

ipcMain.handle('list-routes', (_e, file: string) => {
  try {
    return extractRoutes(file);
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

