# request_mocker

This repository contains a small desktop application built with **Electron** and **TypeScript**. The app lets you load an OpenAPI YAML file and instantly serve the defined routes locally. It is useful for mocking APIs during development without writing backend code.

## Usage

1. Install dependencies with `npm install` (requires Node.js and npm).
2. Build the project using `npm run build`.
3. Start the desktop application with `npm start`.
4. Drag & drop a YAML file onto the window or click **Browse** to select one.
5. Once loaded, all detected endpoints will be listed in the interface.
6. Choose a port (default is `8000`) and click **Start Server**.
7. The routes will be available on `http://localhost:<port>` until you click **Stop Server**.

A minimal YAML parser is included to avoid external dependencies. Only a subset of YAML features is supported.
