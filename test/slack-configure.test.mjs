import assert from 'node:assert/strict';
import test from 'node:test';
import { slackPlatform, parseConfig } from '../scripts/slack-configure.mjs';

test('AstrBot UTF-8 BOM configuration can be read without losing existing values', () => {
  assert.deepEqual(parseConfig('\uFEFF{"admins_id":["U123ABC"],"platform":[]}'), {
    admins_id: ['U123ABC'], platform: [],
  });
});

test('Slack setup requires both token types and an explicit administrator', () => {
  assert.throws(() => slackPlatform({}), /SLACK_BOT_TOKEN/);
  const env = { SLACK_BOT_TOKEN: 'xoxb-test-only', SLACK_APP_TOKEN: 'xapp-test-only' };
  assert.throws(() => slackPlatform(env), /SLACK_ADMIN_USER_ID/);
  const platform = slackPlatform({ ...env, SLACK_ADMIN_USER_ID: 'U123ABC' });
  assert.equal(platform.slack_connection_mode, 'socket');
  assert.equal(platform.type, 'slack');
  assert.equal(platform.enable, true);
});
