import path from 'path';
import {
  startConfiguredServer,
  createLogger,
  createMetrics,
  type MockServerConfig,
  type MockServerHandle,
} from '@request-mocker/core';

export type ServeMode = 'openapi' | 'record' | 'replay';

export interface ServeOptions {
  mode: ServeMode;
  port: number;
  spec?: string;
  data?: string;
  cassettes?: string;
  token?: string;
  delayMs?: number;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  pretty?: boolean;
  enableMetrics?: boolean;
}

export interface ServeResult {
  handle: MockServerHandle;
  port: number;
}

export async function serve(options: ServeOptions): Promise<ServeResult> {
  const logger = createLogger({
    level: options.logLevel ?? 'info',
    name: 'request-mocker',
    pretty: options.pretty ?? false,
  });
  const metrics = options.enableMetrics === false ? undefined : createMetrics();

  let config: MockServerConfig;
  if (options.mode === 'openapi') {
    if (!options.spec) throw new CliError('Missing --spec for openapi mode', 10);
    const baseConfig: MockServerConfig = {
      mode: 'openapi',
      specPath: path.resolve(options.spec),
      port: options.port,
      logger,
      ...(metrics ? { metrics } : {}),
      ...(options.data ? { dataPath: path.resolve(options.data) } : {}),
    };
    config = baseConfig;
  } else {
    const figmaMode: 'record' | 'replay' = options.mode === 'record' ? 'record' : 'replay';
    if (figmaMode === 'record' && !options.token) {
      throw new CliError('Missing --token for record mode', 10);
    }
    config = {
      mode: 'figma-proxy',
      port: options.port,
      logger,
      ...(metrics ? { metrics } : {}),
      adapterOptions: {
        mode: figmaMode,
        ...(options.token !== undefined ? { token: options.token } : {}),
        ...(options.cassettes !== undefined ? { cassetteDir: path.resolve(options.cassettes) } : {}),
      },
    };
  }

  const handle = startConfiguredServer(config);
  if (options.delayMs && options.delayMs > 0) handle.setDelay(options.delayMs);

  const port = await new Promise<number>((resolve, reject) => {
    handle.server.once('listening', () => {
      const addr = handle.server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : options.port);
    });
    handle.server.once('error', err => reject(new CliError(`Listen error: ${err.message}`, 20)));
  });

  return { handle, port };
}

export class CliError extends Error {
  constructor(message: string, readonly exitCode: number) {
    super(message);
    this.name = 'CliError';
  }
}
