#!/usr/bin/env node
import { Command, Option } from 'commander';
import { serve, CliError, type ServeMode } from './serve';

const program = new Command();

program
  .name('request-mocker')
  .description('Headless HTTP mock server for OpenAPI specs and Figma cassettes.')
  .version('1.0.0');

program
  .command('serve')
  .description('Start a mock HTTP server.')
  .option('-s, --spec <path>', 'OpenAPI spec file (YAML or JSON).')
  .option('-p, --port <number>', 'Port to listen on.', value => parseInt(value, 10), 3000)
  .option('-d, --data <path>', 'Optional overrides file.')
  .option('--record', 'Run figma-proxy adapter in record mode.')
  .option('--replay', 'Run figma-proxy adapter in replay mode.')
  .option('--cassettes <dir>', 'Cassette directory (figma-proxy modes).')
  .option('--token <token>', 'Figma API token (record mode).')
  .option('--delay <ms>', 'Artificial response delay in ms.', value => parseInt(value, 10), 0)
  .addOption(
    new Option('--log-level <level>', 'Logger level.')
      .choices(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  )
  .option('--pretty', 'Pretty-print logs (requires pino-pretty).', false)
  .option('--no-metrics', 'Disable /__mock__/metrics endpoint.')
  .action(async opts => {
    try {
      const mode: ServeMode = opts.record ? 'record' : opts.replay ? 'replay' : 'openapi';
      const { handle, port } = await serve({
        mode,
        port: opts.port,
        spec: opts.spec,
        data: opts.data,
        cassettes: opts.cassettes,
        token: opts.token,
        delayMs: opts.delay,
        logLevel: opts.logLevel,
        pretty: opts.pretty,
        enableMetrics: opts.metrics !== false,
      });

      process.stdout.write(`request-mocker listening on http://127.0.0.1:${port}\n`);

      let shuttingDown = false;
      const shutdown = (signal: string): void => {
        if (shuttingDown) return;
        shuttingDown = true;
        handle.logger.info({ signal }, 'cli.shutdown');
        const timer = setTimeout(() => process.exit(30), 5000);
        timer.unref();
        handle.close().then(
          () => process.exit(0),
          () => process.exit(30),
        );
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (err) {
      if (err instanceof CliError) {
        process.stderr.write(`${err.message}\n`);
        process.exit(err.exitCode);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      process.stderr.write(`Unexpected error: ${message}\n`);
      process.exit(20);
    }
  });

program.parseAsync(process.argv);
