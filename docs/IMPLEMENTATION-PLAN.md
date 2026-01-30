# Implementation Plan - Ship-It-Today Model

<!-- markdownlint-disable MD036 MD060 -->

**Project:** Home Assistant Dashboard (hass-dash)  
**Approach:** Continuous Integration / Continuous Delivery (CI/CD)  
**Version:** 1.0  
**Date:** December 31, 2025

---

## Philosophy: Ship Small, Ship Often

This project follows a **"ship-it-today"** philosophy where each pull request delivers production-ready, incremental value. Every merge to `main` is automatically deployed, allowing users to see progress and provide feedback continuously.

### Core Principles

1. **Deployable at Every Commit** - Main branch is always production-ready
2. **Feature Flags** - New features hidden behind flags until complete
3. **Incremental Value** - Each PR adds visible or foundational value
4. **Fail Fast** - Small changes = easier debugging and rollback
5. **Continuous Feedback** - Real users validate direction early

### Release Cadence

- **Micro-releases:** Every merged PR (automated via CI/CD)
- **Weekly builds:** Tagged releases with changelog
- **Monthly milestones:** Larger feature sets with marketing/announcements
- **Quarterly reviews:** Strategic direction and roadmap updates

---

## GitHub Project Management

### Project Structure

**Use GitHub Projects (Kanban Board)**

Create a project board with these columns:

```text
Backlog → Ready → In Progress → In Review → Done → Deployed
```

**Labels:**

- `type: feature` - New functionality
- `type: fix` - Bug fixes
- `type: refactor` - Code improvements
- `type: docs` - Documentation
- `type: test` - Test improvements
- `priority: critical` - Security, major bugs
- `priority: high` - Important features/fixes
- `priority: medium` - Nice to have
- `priority: low` - Future consideration
- `size: xs` - < 2 hours
- `size: s` - 2-4 hours
- `size: m` - 1 day
- `size: l` - 2-3 days
- `size: xl` - > 3 days (break down!)
- `status: blocked` - Cannot proceed
- `status: needs-review` - Ready for feedback
- `area: ui` - User interface
- `area: api` - Backend integration
- `area: testing` - Test infrastructure
- `area: docs` - Documentation

### Issue Templates

**Feature Request Template** (already in CONTRIBUTING.md)  
**Bug Report Template** (already in CONTRIBUTING.md)  
**Micro-release Template** (new - see below)

### Milestones

Create milestones for monthly releases:

- **Milestone 1.0:** Basic Infrastructure (Jan 2026)
- **Milestone 1.1:** Floor Plan Rendering (Feb 2026)
- **Milestone 1.2:** First Overlay (Mar 2026)
- etc.

### Branching Strategy

```text
main (production, protected)
  ↓
feature/welcome-screen → PR → merge → auto-deploy
  ↓
feature/project-setup → PR → merge → auto-deploy
  ↓
feature/floor-plan-base → PR → merge → auto-deploy
```

**Branch naming:**

- `feature/short-description`
- `fix/issue-description`
- `refactor/component-name`
- `docs/what-changed`
- `test/area-coverage`

---

## Iteration Plan: From Zero to Hero

## Feature Requests (Active)

- ROOM-ZOOM
  - Requirements: [docs/feature-requests/ROOM-ZOOM.md](feature-requests/ROOM-ZOOM.md)
  - Implementation: [docs/feature-requests/ROOM-ZOOM-IMPLEMENTATION.md](feature-requests/ROOM-ZOOM-IMPLEMENTATION.md)

Each iteration is a **single PR** that can be merged and deployed immediately.

**Checklist legend:**

- ✅ Completed (implemented in `main`)
- [ ] Pending / not implemented yet

### Phase 0: Foundation (Week 1) ✅ COMPLETED

#### Iteration 0.1: Project Scaffolding ✅ COMPLETED

**Goal:** Developer can clone, build, and see "Hello World"  
**Time:** 4-6 hours  
**Deliverable:** Working Vite + React + TypeScript setup

**Tasks:**

- ✅ Initialize Vite project with React + TypeScript template
- ✅ Configure TypeScript (strict mode)
- ✅ Set up ESLint + Prettier
- [ ] Configure Husky pre-commit hooks
- ✅ Create basic `App.tsx` with initial UI
- ✅ Add basic styling (Tailwind CSS setup)
- ✅ Create package.json with all scripts
- ✅ Write README section: "Running Locally"
- ✅ Add `.env.example` file
- ✅ **Acceptance:** `pnpm dev` shows the app UI in browser

**Welcome Screen Must Include:**

```text
┌─────────────────────────────────────┐
│     🏠 Home Assistant Dashboard     │
│                                     │
│         hass-dash v0.1.0           │
│                                     │
│   Your smart home, visualized.     │
│                                     │
│  Status: 🟡 Development Mode       │
│                                     │
│  [Documentation] [GitHub]          │
└─────────────────────────────────────┘
```

**Feature Flags:** Removed (features are always enabled)

**Files Created:**

```text
src/
  ├── main.tsx
  ├── App.tsx
  ├── App.css (or use Tailwind)
  └── vite-env.d.ts
.eslintrc.json
.prettierrc
tsconfig.json
vite.config.ts
package.json
.env.example
.gitignore
```

---

#### Iteration 0.2: Testing Infrastructure

**Goal:** Test framework operational  
**Time:** 3-4 hours  
**Deliverable:** Tests run, coverage reports work

**Tasks:**

- ✅ Configure Vitest
- ✅ Add example unit test (App.test.tsx)
- ✅ Configure coverage thresholds (80%)
- ✅ Add test scripts to package.json
- ✅ Update CI to run tests (GitHub Actions)
- ✅ **Acceptance:** `pnpm test` passes, coverage report generated

**Feature Flags:** None (testing infrastructure)

---

#### Iteration 0.3: CI/CD Pipeline

**Goal:** Automated deployment on merge  
**Time:** 4-6 hours  
**Deliverable:** GitHub Actions workflow that builds, tests, and deploys

**Tasks:**

- ✅ Create `.github/workflows/ci.yml`
- ✅ Configure build checks (lint, test, build)
- ✅ Set up deployment (GitHub Pages or Netlify)
- ✅ Add status badges to README
- ✅ **Acceptance:** PR triggers checks, merge deploys to live URL

**Feature Flags:** None (infrastructure)

---

#### Iteration 0.4: Dependency Injection Setup

**Goal:** InversifyJS container ready for services  
**Time:** 3-4 hours  
**Deliverable:** DI container with example service

**Tasks:**

- ✅ Install InversifyJS + reflect-metadata
- ✅ Create `src/core/di-container.ts`
- ✅ Create example interface + implementation
- ✅ Create example service consumer (component)
- ✅ Add unit tests for DI setup
- ✅ Document DI patterns in code comments
- ✅ **Acceptance:** Example service injected and used in component

**Feature Flags:** None (architectural foundation)

**Example Service:**

```typescript
interface IConfigService {
  getAppVersion(): string;
}

class ConfigService implements IConfigService {
  getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '0.1.0';
  }
}
```

---

#### Iteration 0.5: Feature Flag System (Removed)

Feature flags were implemented early for CI/CD, then removed once the app reached a stage where features should always be enabled.

**Dev-only diagnostics:** use `import.meta.env.DEV` plus URL query params (e.g., `?debug`, `?debugOverlay`, `?debugLights=1`).

---

### Phase 1: Core Infrastructure (Week 2-3) ✅ COMPLETED

#### Iteration 1.1: Layout & Navigation Shell

**Goal:** App structure with placeholders  
**Time:** 4-5 hours  
**Deliverable:** Header, main content area, footer placeholders

**Tasks:**

- ✅ Create Layout component structure
- ✅ Add Header with app title and menu icon
- ✅ Add main content area (empty, centered welcome message)
- ✅ Add Footer with version and links
- ✅ Implement light/dark mode toggle (functional)
- ✅ Add responsive breakpoints
- ✅ **Acceptance:** Shell renders on all device sizes, theme toggles work

**Feature Flags:**

- Not needed (keep enabled by default)

---

#### Iteration 1.2: Radix UI + Tailwind Integration

**Goal:** Component library ready to use  
**Time:** 3-4 hours  
**Deliverable:** Example Radix components styled with Tailwind

**Tasks:**

- ✅ Install Radix UI primitives
- ✅ Configure Tailwind theme (colors, spacing)
- ✅ Create example Dialog component
- ✅ Create example Button component
- ✅ Document component usage patterns
- ✅ Add storybook-style component showcase page
- ✅ **Acceptance:** Components render, work accessibly

**Feature Flags:**

- Not needed (keep enabled by default)

---

#### Iteration 1.3: State Management Setup

**Goal:** Zustand store with example state  
**Time:** 2-3 hours  
**Deliverable:** Working store for app settings

**Tasks:**

- ✅ Install Zustand + Immer
- ✅ Create `useAppStore` for global settings
- ✅ Store theme preference (light/dark)
- ✅ Store dev-only runtime overrides (dev mode)
- ✅ Create a dedicated dashboard/parity UI store (e.g., `useDashboardStore`) for:
  - active panel state (`agenda | climate | lighting | media | null`)
  - stage view state (`x`, `y`, `scale`) for pan/zoom
  - local-only prototype models (lighting/climate) while HA is not integrated
- ✅ Add persistence middleware (localStorage)
- ✅ Add dev tools integration
- ✅ **Acceptance:** Settings persist across page refresh

**Feature Flags:** None (core functionality)

**Backlog / Follow-ups:**

- [ ] Persisted prototype model size: `partialize` currently persists both lighting + climate models to localStorage. These may grow large; add size limits and/or cleanup for old/unused entries (these models are local-only and will be replaced by HA-backed data).
- [ ] Add a test for state conflicts: verify that `setLightOn(id, true)` overrides any previously set `state` value from `setLightState`.

---

#### Iteration 1.4: Error Boundary & Loading States

**Goal:** Graceful error handling  
**Time:** 2-3 hours  
**Deliverable:** Error boundary with retry, loading spinners

**Tasks:**

- ✅ Create ErrorBoundary component
- ✅ Create LoadingSpinner component
- ✅ Create error page with retry button
- ✅ Add to root App component
- ✅ Test with intentional error
- ✅ **Acceptance:** Errors caught, user can recover

**Feature Flags:** None (reliability feature)

---

#### Iteration 1.5: Dashboard UI Parity (React Component Architecture)

**Goal:** Make the main dashboard UI match the prototype parity spec in a component-driven way

**Time:** 1 day

**Deliverable:** Dashboard refactor plan + component scaffolding aligned with the Prototype → React UI Migration plan

**Notes / Source of truth:**

- See `docs/PROTOTYPE-TO-REACT-UI-MIGRATION.md` for parity requirements and UI inventory.
- The previous parity implementation is preserved under `src/components/prototype--IGNORE/` as a reference prior to deletion.

**React component inventory (authoritative for parity milestone):**

- `DashboardShell` (layout wrapper)
- `DashboardSidebar`
  - `BrandHeader`
  - `WeatherSummary`
  - `QuickActions`
    - `QuickActionButton`
  - `SidebarPanelHost`
    - `AgendaPanel`
    - `LightingPanel`
      - `LightingList`
      - `LightingListItem`
      - `LightingEmptyState`
    - `ClimatePanel`
      - `ThermostatSummary`
      - `TemperatureRange`
    - `MediaPanel` (optional; parity only)
- `DashboardStage`
  - `FloorplanCanvas` (inline SVG wrapper)
    - `FloorplanEmptyOverlay`
  - `MapControls` + `MapControlsToggle`

**Tasks:**

- ✅ Confirm parity UI is the default `Dashboard`
- ✅ Parity UI lives in `Dashboard` now (flag no longer needed)
- ✅ Scaffold the component tree under `src/components/dashboard/` using existing Tailwind tokens only
- ✅ Add RTL tests for:
  - panel switching behavior
  - overlay visibility rules (climate vs lighting)
  - lighting empty state copy

**Follow-ups:**

- [ ] TS/Editor: if `Cannot find namespace 'JSX'` reappears, restart the TS server and verify which `tsconfig` applies to `*.test.tsx`.

**Acceptance:**

- Flag-off: existing UI unchanged
- Flag-on: component tree renders and matches parity layout at a glance

---

#### Iteration 1.6: Prototype Data Sources + DI Wiring (Local-Only)

**Goal:** Preserve SOLID/DI architecture while parity UI is still local-only

**Time:** 4-6 hours

**Deliverable:** DI-backed data sources for prototype YAML/JSON that the dashboard consumes (swappable later for HA)

**Tasks:**

- ✅ Define interfaces:
  - ✅ `IFloorplanDataSource`
  - ✅ `IClimateDataSource`
  - ✅ `ILightingDataSource`
  - [ ] (optional) `IDevicesDataSource`
- ✅ Implement `PublicYamlDataSource` variants that fetch from `public/data/*.yaml`
- ✅ Register implementations in `src/core/di-container.ts`
- ✅ Add a small React helper/hook for DI access (e.g., `useService(TYPES.IFloorplanDataSource)`)
- ✅ Update parity dashboard components to depend on interfaces (DIP), not concrete fetch logic
- ✅ Add unit tests for the data sources (happy path + missing/unparseable YAML)

**Acceptance:**

- Dashboard parity UI loads from `/data/*.yaml` via DI-provided data sources
- Swapping to a different data source is a container binding change, not a UI rewrite

---

### Phase 2: Home Assistant Connection (Week 3-4) ✅ COMPLETED

#### Iteration 2.1: Environment Configuration ✅ COMPLETED

**Goal:** HA connection settings via .env  
**Time:** 2 hours  
**Deliverable:** Validated environment variables

**Tasks:**

- ✅ Create `IHomeAssistantConnectionConfig` interface
- ✅ Implement validation for HA URL and token
- ✅ Create settings form
- ✅ Store connection details securely
- ✅ Add connection status indicator
- ✅ **Acceptance:** User can input HA URL and see validation

**Feature Flags:** Removed

---

#### Iteration 2.2: HTTP Client Service ✅ COMPLETED

**Goal:** REST API calls to Home Assistant  
**Time:** 3-4 hours  
**Deliverable:** Authenticated HTTP client

**Tasks:**

- ✅ Create `IHttpClient` interface
- ✅ Implement `HomeAssistantHttpClient` (Fetch)
- ✅ Add authentication header (Bearer token)
- ✅ Add error handling for non-2xx + JSON parsing
- ✅ Create mock implementations for testing (interface stubs in unit tests)
- ✅ Add connection test coverage (HA smoke test + entity REST fetch)
- ✅ **Acceptance:** Can successfully call HA API

**Feature Flags:** Removed

---

#### Iteration 2.3: WebSocket Service ✅ COMPLETED

**Goal:** Real-time data from Home Assistant  
**Time:** 4-5 hours  
**Deliverable:** WebSocket connection with reconnection

**Tasks:**

- ✅ Create `IWebSocketService` interface
- ✅ Implement `HomeAssistantWebSocketService`
- ✅ Add authentication flow
- ✅ Add reconnection logic
- ✅ Add connection/config status to UI (connection controls + debug panel)
- ✅ Create event subscription system
- ✅ **Acceptance:** WebSocket connects, reconnects on disconnect

**Feature Flags:** Removed

---

#### Iteration 2.4: Entity Service ✅ COMPLETED

**Goal:** Fetch and cache HA entities  
**Time:** 4-5 hours  
**Deliverable:** Entity list and state updates

**Tasks:**

- ✅ Create `IEntityService` interface
- ✅ Implement entity fetch via HTTP
- ✅ Subscribe to entity updates via WebSocket
- ✅ Store entities in Zustand store
- ✅ Create debug view showing entity list
- ✅ Add filtering and search
- ✅ **Acceptance:** Entities display in debug panel, update in real-time

**Feature Flags:** Removed

---

### Phase 3: Floor Plan Foundation (Week 4-5)

#### Iteration 3.1: Floor Plan Data Model

**Goal:** Floor plan data model (YAML-authored)  
**Time:** 2-3 hours  
**Deliverable:** TypeScript types, schema, and example YAML

**Tasks:**

- ✅ Create floor plan TypeScript interfaces
- ✅ Create JSON schema for validation
- ✅ Create example floor plan YAML file
- ✅ Document floor plan format
- ✅ **Acceptance:** Example YAML loads and validates

**Files:**

- `src/features/model/floorplan.ts` (TypeScript model)
- `public/schemas/floorplan.schema.json` (JSON Schema)
- `public/data/floorplan.yaml` (example YAML)
- `src/services/PublicFloorplanYamlDataSource.ts` (YAML loader)
- `src/services/PublicFloorplanYamlDataSource.test.ts` (unit tests)

**Feature Flags:** Removed

---

#### Iteration 3.2: Konva Setup & Basic Canvas

**Goal:** Render empty canvas  
**Time:** 3-4 hours  
**Deliverable:** Interactive canvas with pan/zoom

**Tasks:**

- ✅ Install Konva + react-konva
- ✅ Create Konva canvas component (dev-only toggle: `?konva=1`)
- ✅ Implement pan/zoom controls
- ✅ Add keyboard shortcuts (arrows pan, +/- zoom, `0` reset)
- ✅ **Acceptance:** Canvas renders, user can pan and zoom

**Feature Flags:** Removed

---

#### Iteration 3.3: Room Rendering

**Goal:** Display rooms from floor plan data  
**Time:** 4-5 hours  
**Deliverable:** Static room layout

**Tasks:**

- ✅ Create Room component (Konva shapes)
- ✅ Render rooms from floorplan model
- ✅ Add room labels
- ✅ Add room hover effects
- ✅ Add room click handler (log for now)
- ✅ **Acceptance:** Rooms render correctly, interactive

**Feature Flags:** Removed

---

#### Iteration 3.4: Multi-Floor Navigation (Won't Implement - out of MVP)

**Goal:** Switch between floors  
**Time:** N/A (removed from MVP)  
**Deliverable:** N/A

**Status:** 🚫 Won't implement for MVP. Multi-floor navigation is deferred until after the
single-floor floorplan + overlays experience is stable.

**Tasks:**

- Create floor selector component
- Load multiple floors from JSON
- Switch active floor on selection
- Preserve zoom/pan per floor
- Add keyboard shortcuts (arrow keys, 1-9)
- **Acceptance:** User can navigate between floors

**Feature Flags:** Removed

---

### Phase 4: First Overlay - Lighting (Week 5-6)

#### Iteration 4.1: Overlay System Architecture

**Goal:** Framework for toggling overlays  
**Time:** 3-4 hours  
**Deliverable:** Overlay manager and toggle UI

**Tasks:**

- ✅ Create `IOverlay` interface
- ✅ Create `OverlayManager` component
- ✅ Add overlay toggle buttons
- ✅ Store active overlays in state
- ✅ Create base overlay definition registry
- ✅ **Acceptance:** Overlays can be toggled on/off

**Implementation Notes (Current Code):**

- Interface: `src/interfaces/IOverlay.ts`
- Definitions/registry: `src/components/dashboard/stage/overlayDefinitions.ts`
- Overlay host: `src/components/dashboard/stage/OverlayManager.tsx`
- Toggle UI: `src/components/dashboard/stage/MapControls.tsx`
- State: `src/stores/useDashboardStore.ts`

**Feature Flags:**

- Not needed (keep enabled by default)

---

#### Iteration 4.2: Device Placement on Floor Plan

**Goal:** Show light entities on floor plan  
**Time:** 4-5 hours  
**Deliverable:** Light icons at correct positions

**Tasks:**

- [ ] Add device placement to floor plan JSON
- [ ] Add device placement to floor plan data
- [ ] Create LightIcon component
- [ ] Render lights from entity list + floor plan
- [ ] Show light state (on/off) with color
- [ ] Add hover tooltip with entity details
- [ ] **Acceptance:** Lights appear on floor plan, state-aware

**Feature Flags:**

- Not needed (keep enabled by default)

---

#### Iteration 4.3: Light Control

**Goal:** Toggle lights from UI  
**Time:** 3-4 hours  
**Deliverable:** Click light to toggle

**Tasks:**

- ✅ Create `ILightService` interface
- ✅ Implement light toggle via HA API
- ✅ Add click handler to light icons
- ✅ Add error handling (optimistic update + rollback)
- ✅ **Acceptance:** Clicking light toggles it in HA
- [ ] Show loading state during API call (deferred)
- [ ] Add toast notifications (explicitly deferred; implement as separate feature)

**Feature Flags:**

- Not needed (keep enabled by default)

---

#### Iteration 4.4: Light Details Panel

**Goal:** Brightness and color controls  
**Time:** 4-5 hours  
**Deliverable:** Side panel with light controls

**Tasks:**

- ✅ Create LightDetailsPanel component
- ✅ Show brightness slider (if supported)
- ✅ Show color picker (if supported)
- ✅ Show color temperature (if supported)
- ✅ Call HA service to update
- ✅ **Acceptance:** Full light control from panel

**Feature Flags:**

- Removed

---

### Phase 5: Polish & PWA (Week 6-7)

#### Iteration 5.1: PWA Configuration

**Goal:** Installable PWA  
**Time:** 3-4 hours  
**Deliverable:** App can be installed

**Tasks:**

- ✅ Configure Vite PWA plugin
- ✅ Create web manifest
- ✅ Add app icons (all sizes)
- ✅ Configure service worker
- ✅ Add install prompt
- ✅ **Acceptance:** App can be installed on mobile/desktop

**Feature Flags:** None (core feature)

---

#### Iteration 5.2: Offline Support

**Goal:** Last Known Good values when offline  
**Time:** 4-5 hours  
**Deliverable:** App functions without connection

**Tasks:**

- ✅ Cache entities in IndexedDB
- ✅ Show offline indicator
- ✅ Display LKG values when offline
- ✅ Queue commands for later
- ✅ Sync when back online
- ✅ **Acceptance:** App usable offline

**Feature Flags:** None (core feature)

---

#### Iteration 5.3: Performance Optimization

**Goal:** Lighthouse score 90+  
**Time:** 3-4 hours  
**Deliverable:** Optimized bundle and assets

**Tasks:**

- [ ] Code splitting for routes
- ✅ Lazy load overlays
- [ ] Optimize images (WebP)
- ✅ Minimize bundle size
- ✅ Run Lighthouse audit
- [ ] **Acceptance:** All Core Web Vitals green

**Feature Flags:** None (optimization)

---

#### Iteration 5.4: User Onboarding

**Goal:** First-time user experience  
**Time:** 3-4 hours  
**Deliverable:** Setup wizard

**Tasks:**

- [ ] Create onboarding flow
- [ ] HA connection setup
- [ ] Floor plan upload/creation
- [ ] Quick tour of features
- [ ] Persist completion status
- [ ] **Acceptance:** New user can get started easily

**Feature Flags:**

- Removed

---

## Monthly Milestones

### Milestone 1.0 (End of Month 1)

**Theme:** Foundation & Core Infrastructure  
**Deliverables:**

- ✅ Working app with initial UI
- [ ] HA connection established
- [ ] Basic floor plan rendering
- [ ] First overlay (lighting)
- [ ] PWA installable

**Marketing:**

- Blog post: "Introducing hass-dash"
- Reddit post on r/homeassistant
- Twitter/X announcement
- Demo video

---

### Milestone 1.1 (End of Month 2)

**Theme:** Enhanced Overlays  
**Deliverables:**

- Climate overlay with heat maps
- Surveillance overlay with cameras
- AV overlay
- Network overlay
- Enhanced floor plan editor (Owner mode)

---

### Milestone 1.2 (End of Month 3)

**Theme:** User Experience & Polish  
**Deliverables:**

- Role-based access control
- Mobile app optimization
- Performance tuning
- Accessibility audit
- Documentation complete

---

## CI/CD Pipeline Details

### GitHub Actions Workflow

```yaml
name: CI/CD

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test:coverage
      - run: pnpm build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Deployment Options

**Option 1: GitHub Pages** (Recommended for start)

- Free hosting
- Automatic deployment
- Custom domain support
- HTTPS by default

**Option 2: Netlify**

- Free tier generous
- Deploy previews for PRs
- Better performance
- Edge functions available

**Option 3: Vercel**

- Excellent Next.js integration (if we switch)
- Deploy previews
- Analytics built-in

---

## Dev Diagnostics (Query Params)

Feature flags are supported via `IFeatureFlagService` (env-backed flags with dev-mode runtime overrides). For quick dev-only UI and diagnostics, the app also supports URL query parameters gated by `import.meta.env.DEV`.

Flag env var conventions:

- `VITE_FEATURE_<NAME>=true|false`
- `VITE_OVERLAY_<NAME>=true|false`

Examples:

- `?debug` - show debug panel
- `?debugOverlay` - show tracking/debug overlays (dev only)
- `?debugLights=1` - show lighting debug tools (dev only)

In production builds, these controls should be ignored/disabled.

---

## Measuring Success

### Metrics to Track

**Development:**

- PRs per week (target: 3-5)
- Time to merge (target: < 24 hours)
- Test coverage (target: > 80%)
- Build time (target: < 3 minutes)

**Quality:**

- Lighthouse score (target: 90+)
- Bundle size (target: < 250KB)
- Load time (target: < 3s on 3G)
- Error rate (target: < 1%)

**User Engagement:**

- GitHub stars
- Active installations (PWA installs)
- Community Discord/discussion activity
- Contributor count

---

## Risk Management

### Common Risks

**Risk:** PR too large, hard to review  
**Mitigation:** Break into smaller iterations, use draft PRs

**Risk:** Dev-only diagnostics accidentally shipped as user-facing UI  
**Mitigation:** Guard behind `import.meta.env.DEV` and keep tests around debug-only behavior

**Risk:** Breaking changes slip through  
**Mitigation:** Strict testing requirements, staging environment

**Risk:** Merge conflicts with multiple contributors  
**Mitigation:** Rebase often, communicate in issues, small PRs

---

## Getting Help

### For New Contributors

1. **Read CONTRIBUTING.md** - Start here
2. **Pick a "good first issue"** - Label for newcomers
3. **Ask in Discussions** - Questions welcome
4. **Join Discord/chat** (if available)
5. **Pair program** - Schedule time with maintainer

### For Maintainers

1. **Review PRs daily** - Keep pipeline flowing
2. **Be encouraging** - Celebrate contributions
3. **Provide context** - Explain "why" not just "what"
4. **Unblock contributors** - Prioritize questions
5. **Document decisions** - ADRs (Architecture Decision Records)

---

## Next Steps

**Immediate (Today):**

1. ✅ Read this document
2. ✅ Review GitHub project board setup recommendations
3. ⏭️ Create Iteration 0.1 issue
4. ⏭️ Start Iteration 0.1 implementation

**This Week:**

1. Complete Iteration 0.1-0.5
2. Set up CI/CD pipeline
3. Deploy first version

**This Month:**

1. Complete Phase 0-2 (Foundation + HA Connection)
2. Begin Phase 3 (Floor Plan)
3. Release Milestone 1.0

---

## Document Version

**Version:** 1.0  
**Last Updated:** December 31, 2025  
**Next Review:** Weekly (as iterations progress)

This is a living document. Update as we learn and adapt our process.
