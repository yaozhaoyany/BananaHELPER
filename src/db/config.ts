import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.POSTGRES_PASSWORD) {
    throw new Error('Set POSTGRES_PASSWORD in .env or provide DATABASE_URL.');
  }
  const url = new URL('postgresql://127.0.0.1');
  url.username = process.env.POSTGRES_USER || 'banana_owner';
  url.password = process.env.POSTGRES_PASSWORD;
  url.port = process.env.POSTGRES_PORT || '5432';
  url.pathname = `/${process.env.POSTGRES_DB || 'banana'}`;
  return url.toString();
}
