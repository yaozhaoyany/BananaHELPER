import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(join(root, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const hapi = join(root, 'scripts', 'hapi.mjs');
const home = resolve(root, process.env.HAPI_HOME || 'data/hapi');
const port = Number(process.env.HAPI_LISTEN_PORT || 3006);
const pidFile = join(home, 'banana-hub.pid');
const logFile = join(home, 'banana-hub.log');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid HAPI_LISTEN_PORT: ${process.env.HAPI_LISTEN_PORT}`);
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function portIsOpen() {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('error', () => resolvePromise(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolvePromise(false);
    });
  });
}

function readManagedPid() {
  try {
    const pid = Number(readFileSync(pidFile, 'utf8').trim());
    if (!Number.isInteger(pid) || pid < 1) return null;
    const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    return command.status === 0 && command.stdout.includes('scripts/hapi.mjs hub') ? pid : null;
  } catch {
    return null;
  }
}

function clearPidFile() {
  try {
    unlinkSync(pidFile);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function runHapi(args) {
  return spawnSync(process.execPath, [hapi, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
}

async function startHub() {
  if (await portIsOpen()) {
    const pid = readManagedPid();
    console.log(pid ? `HAPI Hub already running (PID ${pid}).` : `HAPI Hub already running on port ${port}.`);
    return;
  }

  clearPidFile();
  mkdirSync(home, { recursive: true });
  const output = openSync(logFile, 'a');
  const child = spawn(process.execPath, [hapi, 'hub', '--no-relay'], {
    cwd: root,
    detached: true,
    env: process.env,
    stdio: ['ignore', output, output],
  });
  child.unref();
  closeSync(output);
  writeFileSync(pidFile, `${child.pid}\n`);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await portIsOpen()) {
      console.log(`HAPI Hub started (PID ${child.pid}, log: ${logFile}).`);
      return;
    }
    await sleep(200);
  }

  clearPidFile();
  throw new Error(`HAPI Hub did not open port ${port}. Check ${logFile}`);
}

async function start(runnerArgs) {
  await startHub();
  const runner = runHapi(['runner', 'start', ...runnerArgs]);
  if (runner.status !== 0) process.exit(runner.status ?? 1);
  console.log('BananaHELPER is ready. Remote sessions will start Codex app-server through the Runner.');
}

async function status() {
  const pid = readManagedPid();
  const open = await portIsOpen();
  console.log(open ? `Hub: running${pid ? ` (PID ${pid})` : ` (external, port ${port})`}` : 'Hub: stopped');
  const runner = runHapi(['runner', 'status']);
  if (runner.status !== 0) process.exitCode = runner.status ?? 1;
}

async function stop() {
  const runner = runHapi(['runner', 'stop']);
  if (runner.status !== 0) process.exitCode = runner.status ?? 1;

  const pid = readManagedPid();
  if (!pid) {
    clearPidFile();
    if (await portIsOpen()) {
      console.error(`Hub is still running on port ${port}, but it was not started by banana:start. Stop it in its original terminal.`);
      process.exitCode = 1;
    } else {
      console.log('Hub: already stopped');
    }
    return;
  }

  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (!readManagedPid()) {
      clearPidFile();
      console.log('Hub: stopped');
      return;
    }
    await sleep(200);
  }
  console.error(`Hub PID ${pid} did not stop. Check ${logFile}`);
  process.exitCode = 1;
}

function help() {
  console.log(`BananaHELPER local runtime

Usage:
  npm run banana:start -- --workspace-root /absolute/path/to/projects
  npm run banana:status
  npm run banana:stop`);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'start':
    await start(args);
    break;
  case 'status':
    await status();
    break;
  case 'stop':
    await stop();
    break;
  case '--help':
  case '-h':
  case undefined:
    help();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    help();
    process.exitCode = 1;
}
