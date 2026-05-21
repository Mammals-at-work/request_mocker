import http from 'http';

import { createConnection } from '@playwright/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const { _electron: electron } = require('playwright');

(async () => {
    // Launch Electron app.
    const electronApp = await electron.launch({ args: ['dist/main.js'] });

    // Evaluation expression in the Electron context.
    const appPath = await electronApp.evaluate(async ({ app }) => {
        // This runs in the main Electron process, parameter here is always
        // the result of the require('electron') in the main app script.
        return app.getAppPath();
    });
    console.log(appPath);

    // Get the first window that the app opens, wait if necessary.
    const window = await electronApp.firstWindow();
    window.on('console', console.log);

    http.createServer(async (req, res) => {
        // Creates a headless Playwright MCP server with SSE transport
        const connection = await createConnection({ browser: { launchOptions: { headless: true } } });
        const transport = new SSEServerTransport('/messages', res);
        await connection.connect(transport);
    });
})();