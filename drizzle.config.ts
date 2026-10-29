import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/db/config.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['core'],
  dbCredentials: { url: databaseUrl() },
});
