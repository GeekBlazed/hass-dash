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

Each iteration is a **single PR** that can be merged and deployed immediately.

### Phase 0: Foundation (Week 1)

#### Iteration 0.1: Project Scaffolding ✅ NEXT

**Goal:** Developer can clone, build, and see "Hello World"  
**Time:** 4-6 hours  
**Deliverable:** Working Vite + React + TypeScript setup

**Tasks:**

- [ ] Initialize Vite project with React + TypeScript template
- [ ] Configure TypeScript (strict mode)
- [ ] Set up ESLint + Prettier
- [ ] Configure Husky pre-commit hooks
- [ ] Create basic App.tsx with welcome screen
- [ ] Add basic styling (Tailwind CSS setup)
- [ ] Create package.json with all scripts
- [ ] Write README section: "Running Locally"
- [ ] Add .env.example file
- [ ] **Acceptance:** `pnpm dev` shows welcome screen in browser

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

**Feature Flags:**

- `VITE_FEATURE_FLOOR_PLAN=false` (not built yet)
- `VITE_FEATURE_HA_CONNECTION=false` (not built yet)

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

- [ ] Configure Vitest
- [ ] Add example unit test (App.test.tsx)
- [ ] Configure coverage thresholds (80%)
- [ ] Add test scripts to package.json
- [ ] Update CI to run tests (GitHub Actions)
- [ ] **Acceptance:** `pnpm test` passes, coverage report generated

**Feature Flags:** None (testing infrastructure)

---

#### Iteration 0.3: CI/CD Pipeline

**Goal:** Automated deployment on merge  
**Time:** 4-6 hours  
**Deliverable:** GitHub Actions workflow that builds, tests, and deploys

**Tasks:**

- [ ] Create `.github/workflows/ci.yml`
- [ ] Configure build checks (lint, test, build)
- [ ] Set up deployment (GitHub Pages or Netlify)
- [ ] Add status badges to README
- [ ] **Acceptance:** PR triggers checks, merge deploys to live URL

**Feature Flags:** None (infrastructure)

---

#### Iteration 0.4: Dependency Injection Setup

**Goal:** InversifyJS container ready for services  
**Time:** 3-4 hours  
**Deliverable:** DI container with example service

**Tasks:**

- [ ] Install InversifyJS + reflect-metadata
- [ ] Create `src/core/di-container.ts`
- [ ] Create example interface + implementation
- [ ] Create example service consumer (component)
- [ ] Add unit tests for DI setup
- [ ] Document DI patterns in code comments
- [ ] **Acceptance:** Example service injected and used in component

**Feature Flags:** None (architectural foundation)

**Example Service:**

```typescript
interface IConfigService {
  getAppVersion(): string;
  isFeatureEnabled(flag: string): boolean;
}

class ConfigService implements IConfigService {
  getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '0.1.0';
  }
  
  isFeatureEnabled(flag: string): boolean {
    return import.meta.env[`VITE_FEATURE_${flag}`] === 'true';
  }
}
```

---

#### Iteration 0.5: Feature Flag System

**Goal:** Feature flags working throughout app  
**Time:** 2-3 hours  
**Deliverable:** Flag service with React hooks

**Tasks:**

- [ ] Create `IFeatureFlagService` interface
- [ ] Implement FeatureFlagService
- [ ] Create `useFeatureFlag` React hook
- [ ] Add feature flag UI to welcome screen (debug panel)
- [ ] Document feature flag usage
- [ ] Add tests for flag service
- [ ] **Acceptance:** Flags can be toggled, UI responds

**Feature Flags:**

- `VITE_FEATURE_DEBUG_PANEL=true` (show flag status)
- `VITE_FEATURE_FLOOR_PLAN=false`
- `VITE_FEATURE_HA_CONNECTION=false`

---

### Phase 1: Core Infrastructure (Week 2-3)

#### Iteration 1.1: Layout & Navigation Shell

**Goal:** App structure with placeholders  
**Time:** 4-5 hours  
**Deliverable:** Header, main content area, footer placeholders

**Tasks:**

- [ ] Create Layout component structure
- [ ] Add Header with app title and menu icon
- [ ] Add main content area (empty, centered welcome message)
- [ ] Add Footer with version and links
- [ ] Implement light/dark mode toggle (functional)
- [ ] Add responsive breakpoints
- [ ] **Acceptance:** Shell renders on all device sizes, theme toggles work

**Feature Flags:**

- `VITE_FEATURE_NAVIGATION=true` (enabled)

---

#### Iteration 1.2: Radix UI + Tailwind Integration

**Goal:** Component library ready to use  
**Time:** 3-4 hours  
**Deliverable:** Example Radix components styled with Tailwind

**Tasks:**

- [ ] Install Radix UI primitives
- [ ] Configure Tailwind theme (colors, spacing)
- [ ] Create example Dialog component
- [ ] Create example Button component
- [ ] Document component usage patterns
- [ ] Add storybook-style component showcase page
- [ ] **Acceptance:** Components render, work accessibly

**Feature Flags:**

- `VITE_FEATURE_COMPONENT_SHOWCASE=true` (dev only)

---

#### Iteration 1.3: State Management Setup

**Goal:** Zustand store with example state  
**Time:** 2-3 hours  
**Deliverable:** Working store for app settings

**Tasks:**

- [ ] Install Zustand + Immer
- [ ] Create `useAppStore` for global settings
- [ ] Store theme preference (light/dark)
- [ ] Store feature flag overrides (dev mode)
- [ ] Add persistence middleware (localStorage)
- [ ] Add dev tools integration
- [ ] **Acceptance:** Settings persist across page refresh

**Feature Flags:** None (core functionality)

---

#### Iteration 1.4: Error Boundary & Loading States

**Goal:** Graceful error handling  
**Time:** 2-3 hours  
**Deliverable:** Error boundary with retry, loading spinners

**Tasks:**

- [ ] Create ErrorBoundary component
- [ ] Create LoadingSpinner component
- [ ] Create error page with retry button
- [ ] Add to root App component
- [ ] Test with intentional error
- [ ] **Acceptance:** Errors caught, user can recover

**Feature Flags:** None (reliability feature)

---

### Phase 2: Home Assistant Connection (Week 3-4)

#### Iteration 2.1: Environment Configuration

**Goal:** HA connection settings via .env  
**Time:** 2 hours  
**Deliverable:** Validated environment variables

**Tasks:**

- [ ] Create `IConnectionConfig` interface
- [ ] Implement validation for HA URL and token
- [ ] Create settings form (feature-flagged)
- [ ] Store connection details securely
- [ ] Add connection status indicator
- [ ] **Acceptance:** User can input HA URL and see validation

**Feature Flags:**

- `VITE_FEATURE_HA_CONNECTION=true` (enable when ready)

---

#### Iteration 2.2: HTTP Client Service

**Goal:** REST API calls to Home Assistant  
**Time:** 3-4 hours  
**Deliverable:** Authenticated HTTP client

**Tasks:**

- [ ] Create `IHttpClient` interface
- [ ] Implement HomeAssistantHttpClient (Axios)
- [ ] Add authentication interceptor
- [ ] Add error handling interceptor
- [ ] Create mock implementation for testing
- [ ] Add connection test endpoint (`/api/`)
- [ ] **Acceptance:** Can successfully call HA API

**Feature Flags:**

- `VITE_FEATURE_HA_CONNECTION=true`

---

#### Iteration 2.3: WebSocket Service

**Goal:** Real-time data from Home Assistant  
**Time:** 4-5 hours  
**Deliverable:** WebSocket connection with reconnection

**Tasks:**

- [ ] Create `IWebSocketService` interface
- [ ] Implement HomeAssistantWebSocketService
- [ ] Add authentication flow
- [ ] Add reconnection logic
- [ ] Add connection status to UI
- [ ] Create event subscription system
- [ ] **Acceptance:** WebSocket connects, reconnects on disconnect

**Feature Flags:**

- `VITE_FEATURE_HA_CONNECTION=true`

---

#### Iteration 2.4: Entity Service

**Goal:** Fetch and cache HA entities  
**Time:** 4-5 hours  
**Deliverable:** Entity list and state updates

**Tasks:**

- [ ] Create `IEntityService` interface
- [ ] Implement entity fetch via HTTP
- [ ] Subscribe to entity updates via WebSocket
- [ ] Store entities in Zustand store
- [ ] Create debug view showing entity list
- [ ] Add filtering and search
- [ ] **Acceptance:** Entities display in debug panel, update in real-time

**Feature Flags:**

- `VITE_FEATURE_HA_CONNECTION=true`
- `VITE_FEATURE_ENTITY_DEBUG=true` (dev panel)

---

### Phase 3: Floor Plan Foundation (Week 4-5)

#### Iteration 3.1: Floor Plan Data Model

**Goal:** JSON schema for floor plans  
**Time:** 2-3 hours  
**Deliverable:** TypeScript types and example JSON

**Tasks:**

- [ ] Create floor plan TypeScript interfaces
- [ ] Create JSON schema for validation
- [ ] Create example floor plan JSON file
- [ ] Add JSON loader/validator
- [ ] Document floor plan format
- [ ] **Acceptance:** Example JSON loads and validates

**Feature Flags:**

- `VITE_FEATURE_FLOOR_PLAN=true`

---

#### Iteration 3.2: Konva Setup & Basic Canvas

**Goal:** Render empty canvas  
**Time:** 3-4 hours  
**Deliverable:** Interactive canvas with pan/zoom

**Tasks:**

- [ ] Install Konva + react-konva
- [ ] Create FloorPlanCanvas component
- [ ] Implement pan/zoom controls
- [ ] Add grid background (optional)
- [ ] Add keyboard shortcuts (zoom in/out)
- [ ] **Acceptance:** Canvas renders, user can pan and zoom

**Feature Flags:**

- `VITE_FEATURE_FLOOR_PLAN=true`

---

#### Iteration 3.3: Room Rendering

**Goal:** Display rooms from floor plan JSON  
**Time:** 4-5 hours  
**Deliverable:** Static room layout

**Tasks:**

- [ ] Create Room component (Konva shapes)
- [ ] Parse floor plan JSON
- [ ] Render rooms at correct positions/sizes
- [ ] Add room labels
- [ ] Add room hover effects
- [ ] Add room click handler (log for now)
- [ ] **Acceptance:** Rooms render correctly, interactive

**Feature Flags:**

- `VITE_FEATURE_FLOOR_PLAN=true`

---

#### Iteration 3.4: Multi-Floor Navigation

**Goal:** Switch between floors  
**Time:** 3-4 hours  
**Deliverable:** Floor selector UI

**Tasks:**

- [ ] Create floor selector component
- [ ] Load multiple floors from JSON
- [ ] Switch active floor on selection
- [ ] Preserve zoom/pan per floor
- [ ] Add keyboard shortcuts (arrow keys, 1-9)
- [ ] **Acceptance:** User can navigate between floors

**Feature Flags:**

- `VITE_FEATURE_FLOOR_PLAN=true`

---

### Phase 4: First Overlay - Lighting (Week 5-6)

#### Iteration 4.1: Overlay System Architecture

**Goal:** Framework for toggling overlays  
**Time:** 3-4 hours  
**Deliverable:** Overlay manager and toggle UI

**Tasks:**

- [ ] Create `IOverlay` interface
- [ ] Create OverlayManager component
- [ ] Add overlay toggle buttons
- [ ] Store active overlays in state
- [ ] Create base overlay component
- [ ] **Acceptance:** Overlays can be toggled on/off

**Feature Flags:**

- `VITE_FEATURE_OVERLAYS=true`

---

#### Iteration 4.2: Device Placement on Floor Plan

**Goal:** Show light entities on floor plan  
**Time:** 4-5 hours  
**Deliverable:** Light icons at correct positions

**Tasks:**

- [ ] Add device placement to floor plan JSON
- [ ] Create LightIcon component
- [ ] Render lights from entity list + floor plan
- [ ] Show light state (on/off) with color
- [ ] Add hover tooltip with entity details
- [ ] **Acceptance:** Lights appear on floor plan, state-aware

**Feature Flags:**

- `VITE_FEATURE_OVERLAYS=true`
- `VITE_OVERLAY_LIGHTING=true`

---

#### Iteration 4.3: Light Control

**Goal:** Toggle lights from UI  
**Time:** 3-4 hours  
**Deliverable:** Click light to toggle

**Tasks:**

- [ ] Create `ILightService` interface
- [ ] Implement light toggle via HA API
- [ ] Add click handler to light icons
- [ ] Show loading state during API call
- [ ] Add error handling and toast notifications
- [ ] **Acceptance:** Clicking light toggles it in HA

**Feature Flags:**

- `VITE_FEATURE_OVERLAYS=true`
- `VITE_OVERLAY_LIGHTING=true`

---

#### Iteration 4.4: Light Details Panel

**Goal:** Brightness and color controls  
**Time:** 4-5 hours  
**Deliverable:** Side panel with light controls

**Tasks:**

- [ ] Create LightDetailsPanel component
- [ ] Show brightness slider (if supported)
- [ ] Show color picker (if supported)
- [ ] Show color temperature (if supported)
- [ ] Call HA service to update
- [ ] **Acceptance:** Full light control from panel

**Feature Flags:**

- `VITE_FEATURE_OVERLAYS=true`
- `VITE_OVERLAY_LIGHTING=true`

---

### Phase 5: Polish & PWA (Week 6-7)

#### Iteration 5.1: PWA Configuration

**Goal:** Installable PWA  
**Time:** 3-4 hours  
**Deliverable:** App can be installed

**Tasks:**

- [ ] Configure Vite PWA plugin
- [ ] Create web manifest
- [ ] Add app icons (all sizes)
- [ ] Configure service worker
- [ ] Add install prompt
- [ ] **Acceptance:** App can be installed on mobile/desktop

**Feature Flags:** None (core feature)

---

#### Iteration 5.2: Offline Support

**Goal:** Last Known Good values when offline  
**Time:** 4-5 hours  
**Deliverable:** App functions without connection

**Tasks:**

- [ ] Cache entities in IndexedDB
- [ ] Show offline indicator
- [ ] Display LKG values when offline
- [ ] Queue commands for later
- [ ] Sync when back online
- [ ] **Acceptance:** App usable offline

**Feature Flags:** None (core feature)

---

#### Iteration 5.3: Performance Optimization

**Goal:** Lighthouse score 90+  
**Time:** 3-4 hours  
**Deliverable:** Optimized bundle and assets

**Tasks:**

- [ ] Code splitting for routes
- [ ] Lazy load overlays
- [ ] Optimize images (WebP)
- [ ] Minimize bundle size
- [ ] Run Lighthouse audit
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

- `VITE_FEATURE_ONBOARDING=true`

---

## Monthly Milestones

### Milestone 1.0 (End of Month 1)

**Theme:** Foundation & Core Infrastructure  
**Deliverables:**

- Working app with welcome screen ✅
- HA connection established ✅
- Basic floor plan rendering ✅
- First overlay (lighting) ✅
- PWA installable ✅

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

## Feature Flag Management

### Environment Variables

```bash
# .env.example
VITE_APP_VERSION=0.1.0

# Feature Flags
VITE_FEATURE_DEBUG_PANEL=false
VITE_FEATURE_FLOOR_PLAN=false
VITE_FEATURE_HA_CONNECTION=false
VITE_FEATURE_OVERLAYS=false
VITE_FEATURE_ONBOARDING=false

# Overlay Flags
VITE_OVERLAY_LIGHTING=false
VITE_OVERLAY_CLIMATE=false
VITE_OVERLAY_SURVEILLANCE=false
VITE_OVERLAY_AV=false
VITE_OVERLAY_NETWORK=false

# Development
VITE_FEATURE_COMPONENT_SHOWCASE=false
VITE_FEATURE_ENTITY_DEBUG=false
```

### Feature Flag Service

```typescript
interface IFeatureFlagService {
  isEnabled(flag: string): boolean;
  enable(flag: string): void;  // Dev only
  disable(flag: string): void; // Dev only
  getAll(): Record<string, boolean>;
}

// Usage
const showFloorPlan = featureFlags.isEnabled('FLOOR_PLAN');

// React Hook
const { isEnabled } = useFeatureFlag('FLOOR_PLAN');
```

### Production Feature Flags

For production, consider:

- **LaunchDarkly** (feature flag service)
- **Firebase Remote Config** (free tier)
- **Custom API endpoint** (your own service)

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

**Risk:** Feature flag forgotten, never removed  
**Mitigation:** Add "TODO: Remove flag" comments, quarterly flag audit

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
