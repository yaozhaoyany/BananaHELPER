import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(join(root, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (process.env.DATABASE_URL) {
  throw new Error('db:backup backs up the local Compose database. Use pg_dump for an external DATABASE_URL.');
}
const directory = join(root, 'data', 'backups');
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = join(directory, `banana-${new Date().toISOString().replaceAll(':', '-')}.dump`);
const child = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c',
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'], {
  cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
});
const completion = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with ${code}`)));
});
try {
  await Promise.all([pipeline(child.stdout, createWriteStream(target, { flags: 'wx', mode: 0o600 })), completion]);
  console.log(`Backup saved: ${target}`);
} catch (error) {
  await unlink(target).catch(() => {});
  throw error;
}
