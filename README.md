# request_mocker

This repository contains a small desktop application built with **Electron** and **TypeScript**. The app lets you load an OpenAPI YAML file and instantly serve the defined routes locally. It is useful for mocking APIs during development without writing backend code.

## Usage

1. Install dependencies with `npm install` (requires Node.js and npm).
2. Build the project using `npm run build`.
3. Start the desktop application with `npm start`.
4. Drag & drop a YAML file onto the window or click **Browse** to select one.
5. Once loaded, open the **Endpoints** tab to see the parsed routes.
6. The **Logs** tab shows each request made to the mock API.
7. Use the **Settings** tab to choose the port (default `8000`) and interface language before starting the server.
8. Click **Start Server** and the routes will be available on `http://localhost:<port>` until you click **Stop Server**.

A minimal YAML parser is included to avoid external dependencies. Only a subset of YAML features is supported.
