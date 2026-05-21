import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSpec,
  loadSpecFile,
  SpecFileNotFoundError,
  SpecParseError,
} from '../src/specLoader';

const fixtures = path.join(__dirname, '..', 'fixtures');

test('loadSpecFile parses YAML fixture', () => {
  const spec = loadSpecFile(path.join(fixtures, 'sample_api.yaml'));
  const paths = spec.paths!;
  const item = paths['/hello']!;
  const op = item['get']!;
  const example = op.responses!['200']!.content!['application/json']!.example as { message: string };
  expect(example.message).toBe('Hello World');
});

test('loadSpecFile parses JSON fixture', () => {
  const spec = loadSpecFile(path.join(fixtures, 'sample_api.json'));
  expect(spec.paths!['/hello']).toBeDefined();
});

test('resolves YAML anchors and aliases', () => {
  const yaml = `
common: &common
  status: 200
  description: ok
paths:
  /a:
    get:
      responses:
        '200': *common
  /b:
    get:
      responses:
        '200': *common
`;
  const spec = loadSpec(yaml);
  const a = spec.paths!['/a']!['get']!.responses!['200']! as { description?: string };
  const b = spec.paths!['/b']!['get']!.responses!['200']! as { description?: string };
  expect(a.description).toBe('ok');
  expect(b.description).toBe('ok');
});

test('parses YAML multiline scalars', () => {
  const yaml = `
paths:
  /multiline:
    get:
      responses:
        '200':
          description: |
            line one
            line two
          content:
            text/plain:
              example: >
                folded
                scalar
`;
  const spec = loadSpec(yaml);
  const resp = spec.paths!['/multiline']!['get']!.responses!['200']!;
  expect(resp.description).toBe('line one\nline two\n');
  const example = resp.content!['text/plain']!.example as string;
  expect(example.trim()).toBe('folded scalar');
});

test('throws SpecFileNotFoundError for missing file', () => {
  expect(() => loadSpecFile(path.join(fixtures, 'does_not_exist.yaml'))).toThrow(
    SpecFileNotFoundError,
  );
});

test('throws SpecParseError on invalid YAML', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'specloader-'));
  const broken = path.join(tmp, 'broken.yaml');
  fs.writeFileSync(broken, 'paths:\n  /a:\n    get: [unclosed');
  expect(() => loadSpecFile(broken)).toThrow(SpecParseError);
});

test('throws SpecParseError when YAML root is not an object', () => {
  expect(() => loadSpec('- just\n- a list')).toThrow(SpecParseError);
});
