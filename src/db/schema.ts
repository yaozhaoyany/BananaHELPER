import { sql } from 'drizzle-orm';
import { check, index, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const core = pgSchema('core');

export const projects = core.table('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  workspacePath: text('workspace_path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = core.table('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  status: text('status').default('pending').notNull(),
  source: text('source').notNull(),
  hapiSessionId: text('hapi_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('tasks_status_check', sql`${table.status} in ('pending', 'running', 'waiting_approval', 'succeeded', 'failed', 'cancelled')`),
  index('tasks_project_status_idx').on(table.projectId, table.status),
]);
