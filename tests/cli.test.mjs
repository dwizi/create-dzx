import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../bin/index.js');

test('CLI entry point exists', () => {
  assert.ok(fs.existsSync(binPath), 'CLI binary file should exist');
});

test('Package.json has valid bin configuration', () => {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  assert.strictEqual(pkg.bin['create-dzx'], './bin/index.js');
});
