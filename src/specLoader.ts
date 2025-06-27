import { readFileSync } from 'fs';
import { load as loadYaml } from './simpleYaml';

export type SpecObject = any;

export function loadSpec(text: string, ext?: string): SpecObject {
  if (ext === '.json') {
    return JSON.parse(text);
  }
  return loadYaml(text);
}

export function loadSpecFile(filePath: string): SpecObject {
  const text = readFileSync(filePath, 'utf8');
  const ext = filePath.toLowerCase().endsWith('.json') ? '.json' : '.yaml';
  return loadSpec(text, ext);
}
