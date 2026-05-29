# request_mocker

This repository contains a small desktop application built with **Electron** and **TypeScript**. The app lets you load an OpenAPI YAML or JSON file and instantly serve the defined routes locally. It can also run provider-specific adapters, starting with a Figma proxy recorder that captures real API responses and replays them later without network access.

## Usage

1. Install dependencies with `npm install` (requires Node.js and npm).
2. Build the project using `npm run build`.
3. Start the desktop application with `npm start`.

4. Drag & drop a YAML or JSON file onto the window or click **Browse** to select one.
5. Once loaded, open the **Endpoints** tab to see the parsed routes.
6. The **Logs** tab shows each request made to the mock API.
7. Use the **Settings** tab to choose the port (default `8000`) and interface language before starting the server.
8. Optionally provide a JSON or YAML **Data file** to override the example responses for each route.
9. Click **Start Server** and the routes will be available on `http://localhost:<port>` until you click **Stop Server**.

A minimal YAML parser is included to avoid external dependencies. JSON specs are parsed using the built-in JSON parser. Only a subset of YAML features is supported.

## Figma proxy recorder

The Figma adapter has two modes:

- **Record** forwards matching local requests to `https://api.figma.com`, using the token you enter for the current session only.
- **Replay** serves previously recorded cassettes from disk and never calls Figma.

To record a Figma response:

1. Select **Figma** as the source.
2. Choose **Record** and enter a Figma token.
3. Keep the default cassette folder, `mock-cassettes/figma`, or choose another project-local folder.
4. Start the server and call a Figma endpoint through localhost, for example `http://localhost:8000/v1/files/<file-key>`.

To replay the response:

1. Restart or stop the server.
2. Select **Replay**.
3. Call the same localhost endpoint again. If no matching cassette exists, the adapter returns an explicit local miss instead of contacting Figma.

Cassettes are JSON files keyed by method, normalized path/query, and request body hash for non-GET requests. Sensitive headers such as `Authorization`, `X-Figma-Token`, cookies, and `Set-Cookie` are stripped before writing cassettes.

When recording `GET /v1/images/<file-key>?ids=<node-id>&format=png`, the recorder also downloads each PNG URL returned by Figma and stores it under `mock-cassettes/figma/assets`. In replay mode, the response JSON rewrites those temporary Figma image URLs to stable local URLs served by request-mocker, such as `http://localhost:8000/__mock__/figma-assets/<asset>.png`.
