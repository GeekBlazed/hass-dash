# Dev Container (Linux)

This repo includes a VS Code Dev Container definition for a consistent Linux-based dev environment.

## Use

1. Install Docker Desktop (WSL2 backend recommended).
2. In VS Code, open the `hass-dash` folder.
3. Run: **Dev Containers: Reopen in Container**.

The container will:

- Use Node.js 20 on Debian Bookworm
- Enable Corepack and install `pnpm`
- Run `pnpm install` automatically

## Common commands

- `pnpm dev`
- `pnpm test:run`
- `pnpm build`

## Notes

- The Vite dev server is forwarded on port `5173`.
- If Playwright is used, you may need to run `pnpm exec playwright install --with-deps` inside the container.
