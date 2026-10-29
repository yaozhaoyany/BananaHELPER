import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseUrl } from '../src/db/config.ts';

test('database configuration requires credentials and encodes special characters', () => {
  const keys = ['DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_PORT', 'POSTGRES_DB'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.throws(() => databaseUrl(), /Set POSTGRES_PASSWORD/);
    process.env.POSTGRES_PASSWORD = 'space #:@/ password';
    process.env.POSTGRES_PORT = '55432';
    const url = new URL(databaseUrl());
    assert.equal(decodeURIComponent(url.password), process.env.POSTGRES_PASSWORD);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.port, '55432');
    assert.equal(url.pathname, '/banana');
    process.env.DATABASE_URL = 'postgresql://external.example/existing?sslmode=require';
    assert.equal(databaseUrl(), process.env.DATABASE_URL);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
