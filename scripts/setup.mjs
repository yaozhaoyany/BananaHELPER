import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugins = join(root, 'data', 'astrbot', 'plugins');
const target = join(plugins, 'astrbot_plugin_hapi_connector');
const repository = 'https://github.com/LiJinHao999/astrbot_plugin_hapi_connector.git';
const revision = 'f01caa88970035d316122d9d220442559be6d830';

function git(args, cwd = root) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout.trim();
}

mkdirSync(plugins, { recursive: true });

if (existsSync(target)) {
  const current = git(['rev-parse', 'HEAD'], target);
  if (current !== revision) {
    throw new Error(`Connector exists at ${current}; expected ${revision}. Remove or update it explicitly.`);
  }
  console.log('HAPI Connector is already installed at the pinned revision.');
} else {
  git(['clone', '--no-checkout', repository, target]);
  git(['checkout', '--detach', revision], target);
  console.log('HAPI Connector installed.');
}
