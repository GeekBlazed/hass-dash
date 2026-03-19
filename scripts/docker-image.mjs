import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const buildStateFile = path.join(repoRoot, '.docker-build.json');
const envFile = path.join(repoRoot, '.env');

loadDotEnv(envFile);

const packageJson = readJson(path.join(repoRoot, 'package.json'));
const appVersion = packageJson.version;
const imageRepo = process.env.HASS_DASH_IMAGE_REPO || packageJson.name;

const command = process.argv[2];

if (!command || !['build', 'push', 'deploy', 'status'].includes(command)) {
  console.error('Usage: node scripts/docker-image.mjs <build|push|deploy|status>');
  process.exit(1);
}

const state = getState();

switch (command) {
  case 'build': {
    const tag = formatTag(state.build);
    run('docker', ['build', '-t', `${imageRepo}:${tag}`, '-t', `${imageRepo}:latest`, '.']);
    console.log(`Built image tags: ${imageRepo}:${tag}, ${imageRepo}:latest`);
    break;
  }
  case 'push': {
    const nextBuild = state.build + 1;
    const tag = formatTag(nextBuild);
    run('docker', ['build', '-t', `${imageRepo}:${tag}`, '-t', `${imageRepo}:latest`, '.']);
    run('docker', ['push', `${imageRepo}:${tag}`]);
    run('docker', ['push', `${imageRepo}:latest`]);

    const nextState = { version: appVersion, build: nextBuild };
    writeJson(buildStateFile, nextState);

    console.log(`Pushed image tags: ${imageRepo}:${tag}, ${imageRepo}:latest`);
    break;
  }
  case 'deploy': {
    const tag = formatTag(state.build);
    const image = process.env.HASS_DASH_IMAGE || `${imageRepo}:${tag}`;

    run('docker', ['compose', '-f', 'docker-compose.host.yml', 'up', '-d'], {
      HASS_DASH_IMAGE: image,
    });

    console.log(`Deployed with image: ${image}`);
    break;
  }
  case 'status': {
    const tag = formatTag(state.build);
    console.log(`Image repository: ${imageRepo}`);
    console.log(`App version: ${appVersion}`);
    console.log(`Current build: ${state.build}`);
    console.log(`Current versioned tag: ${imageRepo}:${tag}`);
    break;
  }
}

function getState() {
  const defaultState = { version: appVersion, build: 0 };

  if (!existsSync(buildStateFile)) {
    return defaultState;
  }

  const parsed = readJson(buildStateFile);
  const persistedVersion = typeof parsed.version === 'string' ? parsed.version : appVersion;
  const persistedBuild = Number.isInteger(parsed.build) && parsed.build >= 0 ? parsed.build : 0;

  // When package version changes, reset build counter for the new version.
  if (persistedVersion !== appVersion) {
    return defaultState;
  }

  return {
    version: persistedVersion,
    build: persistedBuild,
  };
}

function formatTag(buildNumber) {
  return `${appVersion}-build.${buildNumber}`;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(cmd, args, envOverrides = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
