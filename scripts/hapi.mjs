import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(join(root, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const require = createRequire(import.meta.url);
const packagePath = require.resolve('@twsxtd/hapi/package.json');
const hapiPackage = require(packagePath);
const bin = typeof hapiPackage.bin === 'string' ? hapiPackage.bin : hapiPackage.bin.hapi;
const cli = resolve(dirname(packagePath), bin);
const args = process.argv.slice(2);
const listenPort = process.env.HAPI_LISTEN_PORT || '3006';

const child = spawn(process.execPath, [cli, ...args], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HAPI_HOME: resolve(root, process.env.HAPI_HOME || 'data/hapi'),
    HAPI_API_URL: process.env.HAPI_API_URL || `http://127.0.0.1:${listenPort}`,
    HAPI_LISTEN_HOST: process.env.HAPI_LISTEN_HOST || '0.0.0.0',
    HAPI_LISTEN_PORT: listenPort,
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(`Unable to start HAPI: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
