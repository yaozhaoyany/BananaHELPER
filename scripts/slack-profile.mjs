import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const channel = process.argv[2];
if (process.argv.length !== 3 || !/^[CG][A-Z0-9]+$/.test(channel || '')) {
  throw new Error('Usage: npm run slack:profile -- C0123456789');
}
function docker(args, options = {}) {
  const result = spawnSync('docker', ['compose', ...args], { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`docker compose ${args[0]} failed`);
  return result;
}
const status = docker(['ps', '--status', 'running', '--services'], { encoding: 'utf8', stdio: 'pipe' });
const running = status.stdout.split(/\s+/).includes('astrbot');
if (running) docker(['stop', 'astrbot']);
try {
  const setup = spawnSync(process.execPath, ['scripts/setup.mjs'], { cwd: root, stdio: 'inherit' });
  if (setup.error) throw setup.error;
  if (setup.status !== 0) throw new Error('Connector setup failed');
  docker(['run', '--rm', '-T', '--no-deps', 'astrbot', 'python', '-', channel], {
    input: readFileSync(new URL('./connector-profile.py', import.meta.url)),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
} finally {
  if (running) docker(['up', '-d', 'astrbot']);
}
