export const selectFile = () => window.api.selectFile();
export const startServer = (file, port) => window.api.startServer(file, port);
export const stopServer = () => window.api.stopServer();
export const listRoutes = file => window.api.listRoutes(file);
export const getLogs = () => window.api.getLogs();
export const clearLogs = () => window.api.clearLogs();
