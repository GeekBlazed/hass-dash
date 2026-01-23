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
- Install Playwright browsers + system deps (Chromium/Firefox/WebKit)

## Common commands

- `pnpm dev`
- `pnpm test:run`
- `pnpm build`

## Notes

- The Vite dev server is forwarded on port `5173`.
- Playwright should work out-of-the-box (the container runs `pnpm exec playwright install --with-deps` during setup).
- GitHub Copilot + Copilot Chat extensions are installed in the container, but you still need to sign into GitHub in VS Code for them to activate.
