import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { connectDatabase } from '../src/db/client.js';
import { projects, tasks } from '../src/db/schema.js';

test('core tables enforce relationships and task states without retaining test data', async () => {
  const { db, pool } = connectDatabase();
  const rollback = new Error('rollback test transaction');
  try {
    await assert.rejects(db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({
        name: `integration-${crypto.randomUUID()}`, workspacePath: '/tmp/banana-test',
      }).returning();
      const [task] = await tx.insert(tasks).values({
        projectId: project.id, title: 'Verify storage', source: 'web',
      }).returning();
      assert.equal(task.status, 'pending');
      await tx.update(tasks).set({ status: 'running' }).where(eq(tasks.id, task.id));
      const [running] = await tx.select().from(tasks).where(eq(tasks.id, task.id));
      assert.equal(running.status, 'running');
      await tx.execute(sql`savepoint invalid_status`);
      await assert.rejects(tx.update(tasks).set({ status: 'invalid' }).where(eq(tasks.id, task.id)),
        (error: any) => error.cause?.code === '23514');
      await tx.execute(sql`rollback to savepoint invalid_status`);
      await tx.execute(sql`savepoint restricted_delete`);
      await assert.rejects(tx.delete(projects).where(eq(projects.id, project.id)),
        (error: any) => error.cause?.code === '23503');
      await tx.execute(sql`rollback to savepoint restricted_delete`);
      throw rollback;
    }), (error) => error === rollback);
  } finally {
    await pool.end();
  }
});
