import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrl } from './config.js';
import * as schema from './schema.js';

export function connectDatabase() {
  const pool = new Pool({ connectionString: databaseUrl(), connectionTimeoutMillis: 5000, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
