import { readFileSync } from 'fs';
import { parse as parseYaml, YAMLParseError } from 'yaml';

export interface OpenApiMediaType {
  example?: unknown;
  schema?: unknown;
}

export interface OpenApiResponse {
  description?: string;
  content?: Record<string, OpenApiMediaType>;
  headers?: Record<string, unknown>;
}

export interface OpenApiOperation {
  responses?: Record<string, OpenApiResponse>;
  [key: string]: unknown;
}

export type OpenApiPathItem = Record<string, OpenApiOperation | undefined>;

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info?: Record<string, unknown>;
  paths?: Record<string, OpenApiPathItem | undefined>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

export type OverrideValue =
  | unknown
  | { body?: unknown; status?: number; headers?: Record<string, string> };

export type OverridesDocument = Record<string, OverrideValue>;

export class SpecFileNotFoundError extends Error {
  constructor(public readonly filePath: string, cause?: unknown) {
    super(`Spec file not found: ${filePath}`);
    this.name = 'SpecFileNotFoundError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export class SpecParseError extends Error {
  constructor(message: string, public readonly filePath?: string, cause?: unknown) {
    super(message);
    this.name = 'SpecParseError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export function loadSpec(text: string, ext?: string, filePath?: string): OpenApiDocument {
  try {
    if (ext === '.json') {
      return JSON.parse(text) as OpenApiDocument;
    }
    const value = parseYaml(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new SpecParseError(
        `Spec must be an object at the root; got ${value === null ? 'null' : typeof value}`,
        filePath,
      );
    }
    return value as OpenApiDocument;
  } catch (err) {
    if (err instanceof SpecParseError) throw err;
    if (err instanceof YAMLParseError || err instanceof SyntaxError) {
      throw new SpecParseError(`Failed to parse spec: ${err.message}`, filePath, err);
    }
    throw err;
  }
}

export function loadSpecFile(filePath: string): OpenApiDocument {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new SpecFileNotFoundError(filePath, err);
    throw err;
  }
  const ext = filePath.toLowerCase().endsWith('.json') ? '.json' : '.yaml';
  return loadSpec(text, ext, filePath);
}
