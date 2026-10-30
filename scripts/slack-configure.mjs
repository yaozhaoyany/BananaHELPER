import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function parseConfig(contents) {
  return JSON.parse(contents.replace(/^\uFEFF/, ''));
}

export function slackPlatform(env) {
  if (!env.SLACK_BOT_TOKEN?.startsWith('xoxb-') || !env.SLACK_APP_TOKEN?.startsWith('xapp-')) {
    throw new Error('Set SLACK_BOT_TOKEN (xoxb-) and SLACK_APP_TOKEN (xapp-) in .env.');
  }
  if (!/^[UW][A-Z0-9]+$/.test(env.SLACK_ADMIN_USER_ID || '')) {
    throw new Error('Set SLACK_ADMIN_USER_ID to your Slack member ID (U… or W…).');
  }
  return {
    id: 'banana-slack', type: 'slack', enable: true,
    bot_token: env.SLACK_BOT_TOKEN, app_token: env.SLACK_APP_TOKEN,
    slack_connection_mode: 'socket',
  };
}

function saveConfig(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const backup = `${path}.${Date.now()}.bak`;
    copyFileSync(path, backup);
    chmodSync(backup, 0o600);
  }
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}

function configure() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  try { process.loadEnvFile(join(root, '.env')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  const connectorOnly = process.argv.includes('--connector-only');
  const platform = connectorOnly ? null : slackPlatform(process.env);
  const hapiHome = resolve(root, process.env.HAPI_HOME || 'data/hapi');
  const { cliApiToken } = parseConfig(readFileSync(join(hapiHome, 'settings.json'), 'utf8'));
  if (!cliApiToken) throw new Error('HAPI token is missing. Start HAPI first.');

  const configPath = join(root, 'data/astrbot/cmd_config.json');
  if (!existsSync(configPath)) throw new Error('Start AstrBot once before configuring it.');
  const pluginPath = join(root, 'data/astrbot/config/astrbot_plugin_hapi_connector_config.json');
  const plugin = existsSync(pluginPath) ? parseConfig(readFileSync(pluginPath, 'utf8')) : {};
  plugin.hapi_endpoint = `http://host.docker.internal:${process.env.HAPI_LISTEN_PORT || 3006}`;
  plugin.access_token = cliApiToken;
  plugin.auto_approve_enabled = false;
  plugin.render_mode = 'text';

  if (platform) {
    const config = parseConfig(readFileSync(configPath, 'utf8'));
    config.platform = (config.platform || []).filter((item) => item.id !== platform.id);
    config.platform.push(platform);
    config.admins_id = [...new Set([...(config.admins_id || []), process.env.SLACK_ADMIN_USER_ID])];
    saveConfig(configPath, config);
  }
  saveConfig(pluginPath, plugin);
  console.log(platform ? 'Slack and HAPI Connector configured. Restart AstrBot.' : 'HAPI Connector configured. Restart AstrBot.');
  console.log('Secrets were saved locally; no tokens were printed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) configure();
