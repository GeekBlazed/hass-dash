# Docker Deployment Guide

This guide explains how to:

- Build the production image on machine A.
- Transfer or publish the image.
- Run it on machine B (Docker Desktop host on your private LAN).

This project is a static frontend app. The container serves built files with nginx.

By default, CORS runs in `restricted` mode (RFC1918 + localhost only).

## Prerequisites

- Machine A has Docker installed and can build images.
- Machine B has Docker Desktop installed and running.
- Both machines are on the same local network.
- `public/data/floorplan.yaml` exists on the machine where you run `docker build`.
- You have these files in this repository:
  - `Dockerfile`
  - `nginx.conf`
  - `nginx.open.conf`
  - `docker-compose.host.yml`

## Scripted workflow (recommended)

From repository root:

```bash
# Optional: set your registry repo once per shell
export HASS_DASH_IMAGE_REPO=geekblaze/hass-dash

# Build local image with current tracked build tag + latest
pnpm docker:build

# Increment build number, build image, push versioned tag and latest
pnpm docker:push

# Deploy using the current tracked versioned tag
pnpm docker:deploy
```

Blue-green commands (optional, zero-downtime cutover pattern):

```bash
# Show active color and container health
pnpm docker:bg:status

# Deploy to the inactive color, health-check it, then switch proxy traffic
pnpm docker:bg:switch

# Force switch to a specific color
pnpm docker:bg:switch blue
pnpm docker:bg:switch green
```

### Where version numbers are tracked

- App semantic version is tracked in `package.json` under `version`.
- Docker build number is tracked in `.docker-build.json` under `build`.
- Versioned Docker tag format is: `<app-version>-build.<build-number>` (example: `0.1.0-build.3`).
- `pnpm docker:push` increments `.docker-build.json` and pushes both:
  - `<repo>:<app-version>-build.<build-number>`
  - `<repo>:latest`

If `package.json` version changes, the build counter resets to `0` for the new app version.

## Blue-green on a single host

This repository includes an optional blue-green compose stack with:

- Two app containers: `hass-dash-blue` and `hass-dash-green`
- One fixed entrypoint proxy: `hass-dash-proxy` on port `8080`
- Active upstream config at `docker/nginx.bluegreen.active.conf`

Files:

- `docker-compose.bluegreen.yml`
- `docker/nginx.bluegreen.blue.conf`
- `docker/nginx.bluegreen.green.conf`
- `docker/nginx.bluegreen.active.conf`
- `scripts/docker-bluegreen.mjs`

How switch works:

1. Determine active color from `docker/nginx.bluegreen.active.conf`.
2. Deploy the opposite color with the current build tag (or `HASS_DASH_BLUEGREEN_IMAGE` override).
3. Wait for container health to become healthy/running.
4. Swap proxy config and restart proxy.

Rollback:

```bash
pnpm docker:bg:switch blue
# or
pnpm docker:bg:switch green
```

Notes:

- Existing single-service compose deployment (`docker-compose.host.yml`) remains available.
- Blue-green stack should be run separately from the single-service stack on the same host/port.

## 1) Build the image on machine A

From repository root:

```bash
docker build -t hass-dash:1.0.0 .
```

Note: the Docker build explicitly requires `public/data/floorplan.yaml` and will fail if it is missing.

Optional quick test on machine A:

```bash
docker run --rm -p 8080:80 hass-dash:1.0.0
```

Then open: http://localhost:8080

## 2) Move image to machine B

Use one of the following approaches.

### Option A: Push/Pull via registry (recommended)

On machine A:

```bash
docker tag hass-dash:1.0.0 <registry-user>/hass-dash:1.0.0
docker push <registry-user>/hass-dash:1.0.0
```

On machine B:

```bash
docker pull <registry-user>/hass-dash:1.0.0
```

### Option B: Transfer tar file over LAN (no registry)

On machine A:

```bash
docker save hass-dash:1.0.0 -o hass-dash_1.0.0.tar
```

Transfer `hass-dash_1.0.0.tar` to machine B with SCP, SMB share, USB, etc.

On machine B:

```bash
docker load -i /path/to/hass-dash_1.0.0.tar
```

## 3) Run on machine B with Docker Compose

Optional: create a local `.env` from `.env.example` and set deployment values once:

```bash
cp .env.example .env
```

Then edit `.env` and set at least:

```dotenv
HASS_DASH_IMAGE=hass-dash:1.0.0
HASS_DASH_CORS_MODE=restricted
```

Compose automatically reads `.env` from the repository root.

From repository root on machine B:

```bash
docker compose -f docker-compose.host.yml up -d
```

If you pulled from a registry tag, use that tag instead:

```bash
HASS_DASH_IMAGE=<registry-user>/hass-dash:1.0.0 docker compose -f docker-compose.host.yml up -d
```

Check status:

```bash
docker compose -f docker-compose.host.yml ps
docker logs hass-dash --tail 100
```

## 4) Access from your local network

- On machine B: http://localhost:8080
- From another LAN device: http://<machine-b-lan-ip>:8080

If remote LAN access fails:

- Verify machine B firewall allows inbound TCP 8080.
- Verify Docker Desktop is running.
- Verify both devices are on reachable subnets.

## 5) CORS behavior

This container supports two CORS modes selected by `CORS_MODE`:

- `restricted` (default): allows only origins in these ranges:
  - `localhost` and `127.0.0.1`
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
- `open`: allows any origin (`*`).

`docker-compose.host.yml` defaults to restricted mode with:

```yaml
environment:
  CORS_MODE: ${HASS_DASH_CORS_MODE:-restricted}
```

Switch to open mode when launching:

```bash
HASS_DASH_CORS_MODE=open HASS_DASH_IMAGE=hass-dash:1.0.0 docker compose -f docker-compose.host.yml up -d
```

If using `.env`, you can switch modes by editing `HASS_DASH_CORS_MODE` and then re-running:

```bash
docker compose -f docker-compose.host.yml up -d
```

Switch back to restricted mode:

```bash
HASS_DASH_CORS_MODE=restricted HASS_DASH_IMAGE=hass-dash:1.0.0 docker compose -f docker-compose.host.yml up -d
```

If `HASS_DASH_CORS_MODE` is omitted, `restricted` is used automatically.

## 6) Updating to a new version

On machine A, build a new tag:

```bash
docker build -t hass-dash:1.0.1 .
```

Publish or transfer the new tag/image to machine B, then on machine B:

```bash
HASS_DASH_IMAGE=hass-dash:1.0.1 docker compose -f docker-compose.host.yml up -d
```

Confirm:

```bash
docker compose -f docker-compose.host.yml ps
docker logs hass-dash --tail 100
```

## 7) Roll back

If needed, redeploy a previous tag:

```bash
HASS_DASH_IMAGE=hass-dash:1.0.0 docker compose -f docker-compose.host.yml up -d
```

## 8) Stop and remove service

```bash
docker compose -f docker-compose.host.yml down
```

## Notes for this app

- Since this app is static, nginx is sufficient and lightweight.
- SPA routes are handled by nginx fallback (`try_files ... /index.html`).
- No app server process is required.
- `public/data/floorplan.yaml` is currently baked into the image at build time.
- Future improvement: mount floorplan data as a runtime volume or fetch it from an external config endpoint/service.
