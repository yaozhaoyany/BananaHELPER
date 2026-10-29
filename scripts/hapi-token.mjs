import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(join(root, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const settings = resolve(root, process.env.HAPI_HOME || 'data/hapi', 'settings.json');

try {
  const { cliApiToken } = JSON.parse(await readFile(settings, 'utf8'));
  if (!cliApiToken) throw new Error('cliApiToken is missing');
  console.log(cliApiToken);
} catch (error) {
  console.error(`Unable to read the HAPI token. Start the Hub first: ${error.message}`);
  process.exitCode = 1;
}
