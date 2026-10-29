import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

test('runtime dependencies and secrets stay reproducible', () => {
  assert.match(pkg.dependencies['@twsxtd/hapi'], /^\d+\.\d+\.\d+$/);
  const ignored = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignored, /^data\/hapi\/$/m);
  assert.match(ignored, /^data\/astrbot\/$/m);
  assert.match(ignored, /^\.env$/m);
});

test('AstrBot can reach the host HAPI service without exposing host files', () => {
  const compose = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
  assert.match(compose, /host\.docker\.internal:host-gateway/);
  assert.match(compose, /\.\/data\/astrbot:\/AstrBot\/data/);
  assert.doesNotMatch(compose, /\.codex|docker\.sock/);
});

test('the local HAPI launcher resolves and forwards CLI arguments', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/hapi.mjs', import.meta.url)), '--version'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\d+\.\d+\.\d+/);
});
