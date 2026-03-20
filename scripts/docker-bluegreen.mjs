import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const envFile = path.join(repoRoot, '.env');
const packageJsonFile = path.join(repoRoot, 'package.json');
const dockerStateFile = path.join(repoRoot, '.docker-build.json');
const composeFile = 'docker-compose.bluegreen.yml';

const blueTemplate = path.join(repoRoot, 'docker', 'nginx.bluegreen.blue.conf');
const greenTemplate = path.join(repoRoot, 'docker', 'nginx.bluegreen.green.conf');
const activeProxyConf = path.join(repoRoot, 'docker', 'nginx.bluegreen.active.conf');

loadDotEnv(envFile);

const command = process.argv[2];
if (!command || !['switch', 'status'].includes(command)) {
  console.error('Usage: node scripts/docker-bluegreen.mjs <switch|status> [blue|green]');
  process.exit(1);
}

if (command === 'status') {
  printStatus();
  process.exit(0);
}

const desiredColor = normalizeColor(process.argv[3]);
const activeColor = getActiveColor();
const targetColor = desiredColor || opposite(activeColor);
const targetService = serviceFor(targetColor);
const image = resolveImageTag();

console.log(`Active color: ${activeColor}`);
console.log(`Target color: ${targetColor}`);
console.log(`Deploying image: ${image}`);

const imageEnvKey = targetColor === 'blue' ? 'HASS_DASH_BLUE_IMAGE' : 'HASS_DASH_GREEN_IMAGE';
runCompose(['up', '-d', targetService], {
  [imageEnvKey]: image,
});

waitForHealthy(containerFor(targetColor), 120);

copyFileSync(templateFor(targetColor), activeProxyConf);
runCompose(['up', '-d', 'hass-dash-proxy']);
runCompose(['restart', 'hass-dash-proxy']);

console.log(`Switched traffic to ${targetColor}.`);
console.log(`Rollback: pnpm docker:bg:switch ${activeColor}`);

function printStatus() {
  const active = getActiveColor();
  const image = resolveImageTag();

  console.log(`Active color: ${active}`);
  console.log(`Default deploy image: ${image}`);

  const blueStatus = inspectContainer(containerFor('blue'));
  const greenStatus = inspectContainer(containerFor('green'));
  const proxyStatus = inspectContainer('hass-dash-proxy');

  console.log(`Blue container: ${blueStatus}`);
  console.log(`Green container: ${greenStatus}`);
  console.log(`Proxy container: ${proxyStatus}`);
}

function resolveImageTag() {
  if (process.env.HASS_DASH_BLUEGREEN_IMAGE) {
    return process.env.HASS_DASH_BLUEGREEN_IMAGE;
  }

  const packageJson = readJson(packageJsonFile);
  const releaseVersion = resolveReleaseVersion();
  const imageRepo = process.env.HASS_DASH_IMAGE_REPO || packageJson.name;

  let build = 0;
  if (existsSync(dockerStateFile)) {
    const state = readJson(dockerStateFile);
    if (state.version === releaseVersion && Number.isInteger(state.build) && state.build >= 0) {
      build = state.build;
    }
  }

  return `${imageRepo}:${releaseVersion}-build${build}`;
}

function resolveReleaseVersion() {
  const configured = process.env.HASS_DASH_RELEASE_VERSION?.trim();
  if (configured) {
    return configured;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const releaseIndex = now.getUTCDate();

  return `${year}.${month}.${releaseIndex}`;
}

function getActiveColor() {
  if (!existsSync(activeProxyConf)) {
    return 'blue';
  }

  const conf = readFileSync(activeProxyConf, 'utf8');
  if (conf.includes('hass-dash-green')) {
    return 'green';
  }

  return 'blue';
}

function templateFor(color) {
  return color === 'green' ? greenTemplate : blueTemplate;
}

function opposite(color) {
  return color === 'blue' ? 'green' : 'blue';
}

function serviceFor(color) {
  return `hass-dash-${color}`;
}

function containerFor(color) {
  return `hass-dash-${color}`;
}

function normalizeColor(input) {
  if (!input) {
    return null;
  }

  const value = input.trim().toLowerCase();
  if (value === 'blue' || value === 'green') {
    return value;
  }

  console.error(`Invalid color: ${input}. Use blue or green.`);
  process.exit(1);
}

function waitForHealthy(containerName, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    const status = inspectContainer(containerName);
    if (status === 'healthy' || status === 'running') {
      return;
    }

    if (status === 'unhealthy' || status === 'exited' || status === 'dead') {
      console.error(`${containerName} reported unhealthy status: ${status}`);
      process.exit(1);
    }

    sleep(2000);
  }

  console.error(`Timed out waiting for ${containerName} to become healthy.`);
  process.exit(1);
}

function inspectContainer(containerName) {
  const result = run(
    'docker',
    [
      'inspect',
      '-f',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
      containerName,
    ],
    {},
    true
  );

  if (result.status !== 0) {
    return 'not-created';
  }

  return (result.stdout || '').trim() || 'unknown';
}

function runCompose(args, envOverrides = {}) {
  return run('docker', ['compose', '-f', composeFile, ...args], envOverrides, false);
}

function run(cmd, args, envOverrides = {}, capture = false) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if (!capture && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy wait is acceptable here for a short-lived CLI script.
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || key in process.env) {
      continue;
    }

    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(value);
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
