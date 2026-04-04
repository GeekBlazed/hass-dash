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
const imageRepo = process.env.HASS_DASH_IMAGE_REPO || packageJson.name;
const releaseVersion = resolveReleaseVersion();

const command = process.argv[2];

if (!command || !['build', 'push', 'deploy', 'status'].includes(command)) {
  console.error('Usage: node scripts/docker-image.mjs <build|push|deploy|status>');
  process.exit(1);
}

const state = getState();

switch (command) {
  case 'build': {
    const releaseTag = formatReleaseTag();
    const buildTag = formatBuildTag(state.build);
    run('docker', [
      'build',
      '--build-arg',
      `APP_VERSION=${buildTag}`,
      '-t',
      `${imageRepo}:${releaseTag}`,
      '-t',
      `${imageRepo}:${buildTag}`,
      '-t',
      `${imageRepo}:latest`,
      '.',
    ]);
    console.log(
      `Built image tags: ${imageRepo}:${releaseTag}, ${imageRepo}:${buildTag}, ${imageRepo}:latest`
    );
    break;
  }
  case 'push': {
    const nextBuild = state.build + 1;
    const releaseTag = formatReleaseTag();
    const buildTag = formatBuildTag(nextBuild);
    run('docker', [
      'build',
      '--build-arg',
      `APP_VERSION=${buildTag}`,
      '-t',
      `${imageRepo}:${releaseTag}`,
      '-t',
      `${imageRepo}:${buildTag}`,
      '-t',
      `${imageRepo}:latest`,
      '.',
    ]);
    run('docker', ['push', `${imageRepo}:${releaseTag}`]);
    run('docker', ['push', `${imageRepo}:${buildTag}`]);
    run('docker', ['push', `${imageRepo}:latest`]);

    const nextState = { version: releaseVersion, build: nextBuild };
    writeJson(buildStateFile, nextState);

    console.log(
      `Pushed image tags: ${imageRepo}:${releaseTag}, ${imageRepo}:${buildTag}, ${imageRepo}:latest`
    );
    break;
  }
  case 'deploy': {
    const image = process.env.HASS_DASH_IMAGE || `${imageRepo}:${formatBuildTag(state.build)}`;

    run('docker', ['compose', '-f', 'docker-compose.host.yml', 'up', '-d'], {
      HASS_DASH_IMAGE: image,
    });

    console.log(`Deployed with image: ${image}`);
    break;
  }
  case 'status': {
    const releaseTag = formatReleaseTag();
    const buildTag = formatBuildTag(state.build);
    console.log(`Image repository: ${imageRepo}`);
    console.log(`Release version: ${releaseVersion}`);
    console.log(`Current build: ${state.build}`);
    console.log(`Current release tag: ${imageRepo}:${releaseTag}`);
    console.log(`Current build tag: ${imageRepo}:${buildTag}`);
    break;
  }
}

function getState() {
  const defaultState = { version: releaseVersion, build: 0 };

  if (!existsSync(buildStateFile)) {
    return defaultState;
  }

  const parsed = readJson(buildStateFile);
  const persistedVersion = typeof parsed.version === 'string' ? parsed.version : releaseVersion;
  const persistedBuild = Number.isInteger(parsed.build) && parsed.build >= 0 ? parsed.build : 0;

  // When release version changes, reset build counter for the new version.
  if (persistedVersion !== releaseVersion) {
    return defaultState;
  }

  return {
    version: persistedVersion,
    build: persistedBuild,
  };
}

function formatReleaseTag() {
  return releaseVersion;
}

function formatBuildTag(buildNumber) {
  return `${releaseVersion}-build${buildNumber}`;
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
