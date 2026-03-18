# Copilot Instructions (hass-dash) - Draft

**IMPORTANT:** This file is a shared workgroup document. Do not add personal rules for agents here. Those should be added to your personal local directory where your agent has access. Common locations are:

- `~/.copilot/instructions/user.instructions.md` on Linux
- `/Users/<your-user>/.copilot/instructions/user.instructions.md` on macOS
- `%USERPROFILE%\\.copilot\\instructions\\user.instructions.md` on Windows.

## Purpose

This file is intentionally short and operational.
It keeps only repo-specific guidance that helps coding agents make correct changes quickly.
Background standards and process details are linked in the "Resources" section.

## Quick Context

- Stack: React 19 + TypeScript (strict) + Vite 7 + Tailwind 4.
- App type: PWA front-end for Home Assistant.
- Architecture: interface-first services with InversifyJS DI.
- State: Zustand stores under `src/stores/*` (some persisted for offline/LKG behavior).

## What To Optimize For

- Small, focused diffs.
- Preserve existing naming/style.
- Respect DI and feature-flag patterns.
- Prefer targeted tests first, then broader validation.

## Critical Repo Rules

### Dependency Injection (required)

When adding a service, follow this order:

1. Add interface in `src/interfaces/IServiceName.ts`.
2. Add symbol in `src/core/types.ts` (`TYPES.IServiceName`).
3. Add implementation in `src/services/ServiceName.ts` with `@injectable()`.
4. Bind it in `src/core/di-container.ts` using `.inSingletonScope()`.
5. Add/update tests for service behavior and DI wiring.

In React code, prefer `src/hooks/useService.ts` over ad-hoc `container.get(...)`.

### Feature Flags (required)

- Flags are env-backed with `VITE_FEATURE_*` and `VITE_OVERLAY_*`.
- In UI code, consume flags via `useFeatureFlag` / `useFeatureFlags` from `src/hooks/useFeatureFlag.ts`.
- Runtime flag overrides are supported via `sessionStorage` in non-production.
- Do not introduce direct `import.meta.env` checks in components when hook/service usage exists.

### Runtime / Imports (required)

- `reflect-metadata` must load before decorated classes (see `src/main.tsx`).
- Path aliases are not configured. Use relative imports.

## Home Assistant + Data Flow

- Reuse existing Home Assistant client/services and subscription pipeline.
- Do not create parallel WebSocket streams for the same concern.
- Entity state is cached in `src/stores/useEntityStore.ts` with persistence and LKG behavior.
- WebSocket streams are chatty: avoid setting React state on every message.

## Tracking + Prototype Notes

- Tracking/prototype history docs live in `docs/archive/`.
- For active location-tracking context, start with `docs/wiki/LOCATION-TRACKING.md`.
- Prototype/parity UI work is usually in `src/components/prototype/` with data in `public/data/`.
- Treat `public/scripts.js` as archival unless change scope explicitly targets legacy prototype runtime behavior.

## Workflow Source Of Truth

Use `package.json` scripts as the canonical command surface.

- Requirements: Node `>=22`, pnpm `9.x`.
- Build: `pnpm build` (`tsc -b && vite build`).
- Default tests: `pnpm test` (batched runner).
- Include slow tests: `pnpm test:all`.
- Coverage: `pnpm test:coverage` / `pnpm test:coverage:all`.
- Useful tuning knobs: `VITEST_HEAP_MB`, `VITEST_BATCH_SIZE`, `VITEST_COVERAGE_HEAP_MB`, `VITEST_SKIP_OOM_TESTS`.

## Practical Edit Guidance

### When adding new behavior

- Put business logic behind interfaces.
- Bind implementations in DI container as singletons.
- Gate incomplete UX behind feature flags.
- Prefer extending existing services/stores over parallel architecture.

### When touching dashboard / high-frequency updates

- Avoid render-path heavy work for incoming stream events.
- Use store-level updates and controlled subscriptions.
- Keep UI updates coarse-grained where possible.

## CI/CD Considerations

### Pre-commit Checks

**IMPORTANT:** Code is _never_ committed directly to `main`.

Every commit should pass:

- `pnpm lint` - ESLint checks
- `pnpm format` - Prettier formatting
- `pnpm type-check` - TypeScript compilation
- `pnpm build`
- `pnpm test` - Unit tests

### Validation Checklist (When Updating Code)

When you change code in this repo, validation must include a production build.

- Always run `pnpm build` as one of the validation steps.
- Prefer running the most targeted tests first, then a broader suite if needed.

### Pull Request Requirements

- All CI checks passing
- 80% code coverage maintained
- No TypeScript errors
- Bundle size within limits
- At least 1 approval

## Key Files and Directories

- Boot/PWA: `src/main.tsx`, `src/pwa/*`
- DI: `src/core/types.ts`, `src/core/di-container.ts`
- Interfaces: `src/interfaces/*`
- Services: `src/services/*`
- Feature flags: `src/services/FeatureFlagService.ts`, `src/hooks/useFeatureFlag.ts`
- Dashboard UI: `src/components/dashboard/*`
- Entity cache store: `src/stores/useEntityStore.ts`

## Explicit Non-Goals For This File

This file should not duplicate:

- full contribution process/checklists,
- broad web standards tutorials,
- large code pattern catalogs,
- long architecture essays.

Keep those in the linked docs below.

---

## Resources

- [DEVELOPMENT-STANDARDS.md](../DEVELOPMENT-STANDARDS.md) - Web standards, accessibility, security, performance
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution workflow and repo conventions
- [docs/REQUIREMENTS.md](../docs/REQUIREMENTS.md) - Full project requirements
- [docs/TECHNOLOGY-STACK.md](../docs/TECHNOLOGY-STACK.md) - Detailed tech decisions
- [docs/IMPLEMENTATION-PLAN.md](../docs/IMPLEMENTATION-PLAN.md) - Roadmap and planned iterations
- [docs/wiki/LOCATION-TRACKING.md](../docs/wiki/LOCATION-TRACKING.md) - Tracking context (active)

---

## Quick Commands

```bash
# Development
pnpm dev             # Start dev server
pnpm build           # Production build (tsc -b + vite build)
pnpm preview         # Preview production build

# Testing
pnpm test            # Run tests in watch mode
pnpm test:run        # Run tests once
pnpm test:ui         # Open Vitest UI
pnpm test:coverage   # Run tests with coverage report

# Code Quality
pnpm lint            # ESLint
pnpm format          # Prettier (write)
pnpm format:check    # Prettier (check only)
pnpm type-check      # TypeScript (no emit)
```

**Remember:** This project prioritizes code quality, accessibility, and user experience. When in doubt, favor explicitness over brevity, and always follow SOLID principles.

---

## Maintenance Rule

If a rule here is stale, update this file or remove it and link to the canonical source.
Do not let this file drift into a second full handbook.
