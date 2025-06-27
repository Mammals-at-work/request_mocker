const path = require('path');
const { load, loadFile } = require('../dist/simpleYaml.js');
const { loadSpecFile } = require('../dist/specLoader.js');

test('parse scalars correctly', () => {
  const yaml = 'num: 42\nflag: true\nstr: "hello"\n';
  const obj = load(yaml);
  expect(obj).toEqual({ num: 42, flag: true, str: 'hello' });
});

test('load sample YAML file', () => {
  const obj = loadFile(path.join(__dirname, '..', 'sample_api.yaml'));
  expect(obj.paths['/hello'].get.responses['200'].content['application/json'].example.message)
    .toBe('Hello World');
});

test('load sample JSON file', () => {
  const obj = loadSpecFile(path.join(__dirname, '..', 'sample_api.json'));
  expect(obj.paths['/hello'].get.responses['200'].content['application/json'].example.message)
    .toBe('Hello World');
});
