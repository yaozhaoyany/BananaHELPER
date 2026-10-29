import { sql } from 'drizzle-orm';
import { connectDatabase } from '../src/db/client.js';
import { projects, tasks } from '../src/db/schema.js';

const { db, pool } = connectDatabase();
try {
  await db.select({ id: projects.id }).from(projects).limit(1);
  await db.select({ id: tasks.id }).from(tasks).limit(1);
  const result = await db.execute(sql`select current_database() as database, current_user as role`);
  console.log('Database and core tables ready:', result.rows[0]);
} finally {
  await pool.end();
}
