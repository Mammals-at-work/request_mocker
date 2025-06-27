export type YAMLValue = string | number | boolean | YAMLObject | YAMLArray;
export interface YAMLObject { [key: string]: YAMLValue; }
export type YAMLArray = YAMLValue[];

function parseValue(value: string): YAMLValue {
  if (value === 'true' || value === 'True') return true;
  if (value === 'false' || value === 'False') return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (!isNaN(Number(value))) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function load(text: string): YAMLValue {
  const lines = text.split(/\r?\n/);
  const root: YAMLObject = {};
  const stack: Array<{indent: number; node: YAMLValue}> = [{indent: -1, node: root}];

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)![0].length;
    const line = raw.trim();
    while (stack.length && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node as YAMLObject | YAMLArray;

    if (line.startsWith('- ')) {
      const val = parseValue(line.slice(2).trim());
      if (!Array.isArray(parent)) {
        if (typeof parent === 'object' && Object.keys(parent).length) {
          const keys = Object.keys(parent);
          const lastKey = keys[keys.length - 1];
          const last = (parent as YAMLObject)[lastKey];
          if (
            last &&
            typeof last === 'object' &&
            !Array.isArray(last) &&
            Object.keys(last).length === 0
          ) {
            (parent as YAMLObject)[lastKey] = [];
          }
          if (Array.isArray((parent as YAMLObject)[lastKey])) {
            ((parent as YAMLObject)[lastKey] as YAMLArray).push(val);
            if (typeof val === 'object') {
              stack.push({ indent, node: val });
            } else {
              stack.push({ indent, node: (parent as YAMLObject)[lastKey] as YAMLArray });
            }
            continue;
          }
        }
        throw new Error('Invalid YAML list placement');
      } else {
        parent.push(val);
        stack.push({indent, node: val});
        continue;
      }
    }

    const idx = line.indexOf(':');
    if (idx !== -1) {
      let key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((key.startsWith('"') && key.endsWith('"')) ||
          (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }
      let item: YAMLValue;
      if (val === '') {
        item = {};
      } else {
        item = parseValue(val);
      }
      if (typeof parent === 'object' && !Array.isArray(parent)) {
        parent[key] = item;
      } else {
        throw new Error('Invalid YAML structure');
      }
      if (typeof item === 'object') {
        stack.push({indent, node: item});
      }
    } else {
      throw new Error('Unsupported YAML line: ' + line);
    }
  }

  return root;
}

import { readFileSync } from 'fs';
export function loadFile(path: string): YAMLValue {
  const text = readFileSync(path, 'utf8');
  return load(text);
}
