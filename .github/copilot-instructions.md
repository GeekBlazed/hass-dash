# GitHub Copilot Instructions - hass-dash

## Project Overview

**Project:** Home Assistant Dashboard (hass-dash)  
**Type:** Progressive Web Application (PWA)  
**Tech Stack:** React 19.2, TypeScript (strict), Vite 7.2, Tailwind CSS 4  
**Architecture:** SOLID principles with InversifyJS for dependency injection  
**License:** MIT  
**Current Status:** Foundation complete (DI + feature flags + dashboard scaffold) ✅

This is a visual, user-friendly front-end companion to Home Assistant. The application will provide a 2D spatial interface for monitoring and controlling smart home devices through various overlay systems (lighting, climate, surveillance, AV, networking).

**What's Implemented:**

- ✅ Vite + React + TypeScript setup with strict mode
- ✅ Tailwind CSS 4 with dark mode support
- ✅ ESLint + Prettier configuration
- ✅ Dashboard-first UI (see [App.tsx](../src/App.tsx) and [Dashboard.tsx](../src/components/dashboard/Dashboard.tsx))
- ✅ Basic UI primitives (Radix Dialog/Switch/Dropdown; see `src/components/ui/*`)
- ✅ Environment variable support
- ✅ Vitest testing framework with React Testing Library
- ✅ Coverage reporting with 96%+ actual coverage
- ✅ GitHub Actions CI workflow
- ✅ InversifyJS DI container with services (ConfigService, FeatureFlagService)
- ✅ Zustand state management (see `src/stores/*`)
- ✅ TypeScript decorators enabled for DI
- ✅ Feature flag system with runtime overrides
- ✅ Custom React hooks (useFeatureFlag, useFeatureFlags)
- ✅ Debug panel component for feature flag management
- ✅ Component showcase (feature-flagged) for UI primitives
- ✅ Home Assistant integration (HTTP + WebSocket) with entity subscription/services
- ✅ Device/person tracking (ESPresense via HA entities) with People-based labeling + avatars

**Not Yet Implemented:**

- ⏳ Konva.js floor plans (Phase 3)
- ⏳ PWA install/offline polish (Phase 5)

See [IMPLEMENTATION-PLAN.md](../docs/IMPLEMENTATION-PLAN.md) for detailed roadmap.

---

## Current Codebase State

**Current Codebase State:**

- Basic Vite + React scaffold with TypeScript strict mode
- Dashboard-first UI ([App.tsx](../src/App.tsx))
- Component showcase for UI primitives (feature-flagged)
- Tailwind CSS 4 configured with custom theme colors (see [tailwind.config.js](../tailwind.config.js))
- Environment variables in `.env.example` with feature flags
- ESLint with flat config using typescript-eslint
- **Vitest testing framework** with React Testing Library
- **Test coverage reporting** with 96%+ actual coverage
- **GitHub Actions CI** running tests, linting, and builds
- **InversifyJS DI container** ([di-container.ts](../src/core/di-container.ts)) with type identifiers ([types.ts](../src/core/types.ts))
- **Service implementations:** ConfigService and FeatureFlagService with interfaces and comprehensive tests
- **Home Assistant integration:** HTTP + WebSocket services, entity cache + subscription pipeline
- **TypeScript decorators enabled** in tsconfig.app.json
- **Feature flag system** with sessionStorage overrides for dev mode
- **Custom React hooks** for feature flag consumption (useFeatureFlag, useFeatureFlags)
- **DebugPanel component** for visualizing and toggling feature flags
- Zustand stores in `src/stores/*` (including persisted tracking stores)

---

## Prototype Data (public/data)

Prototype YAML used by the React parity UI lives under `public/data/` and is loaded via `fetch('/data/*.yaml')`.

**Prototype data inputs (YAML):**

- `public/data/floorplan.yaml` – room geometry + labels used to render the SVG floorplan
- `public/data/devices.yaml` – device marker positions/labels
- `public/data/climate.yaml` – per-room climate values used by the Climate panel/overlay
- `public/data/lighting.yaml` – lights + scenes used by the Lighting panel/overlay

**Prototype interaction model (important):**

- Sidebar panels are mutually exclusive and shown/hidden using the `.is-hidden` class (e.g., Agenda vs Climate vs Lighting).
- “Quick actions” are the entry points that toggle which sidebar panel is active.
- The SVG floorplan is layered using `<g>` groups; overlays are turned on/off by showing/hiding the corresponding layer.
- Lighting controls in the prototype are **local-only**: toggles update an in-memory model and re-render the UI (they do not persist to YAML and do not call Home Assistant).
- `public/data/lighting.yaml` is treated as optional; if it is missing/unparseable, or if no lights are currently on, the Lighting panel should display: “There are no lights on.”

**When working on floorplan/overlay/panel UI:**

- If the request mentions “prototype”, “floorplan-prototype”, “data/\*.yaml”, or “panels in the sidebar”, the target is almost always the React parity UI under `src/components/prototype/`.
- Keep the prototype as a single-file artifact unless there’s an explicit request to modularize.
- Do not introduce new colors/tokens in the prototype; it intentionally mirrors the Tailwind theme values from `tailwind.config.js` using CSS variables.

**DI Container Setup:**

The project now has a fully functional dependency injection system using InversifyJS:

```typescript
// src/core/types.ts - Define type identifiers
export const TYPES = {
  IConfigService: Symbol.for('IConfigService'),
  IFeatureFlagService: Symbol.for('IFeatureFlagService'),
};

// src/interfaces/IConfigService.ts - Define interface
export interface IConfigService {
  getAppVersion(): string;
  isFeatureEnabled(flag: string): boolean;
  getConfig(key: string): string | undefined;
}

// src/services/ConfigService.ts - Implement service
import { injectable } from 'inversify';
import type { IConfigService } from '../interfaces/IConfigService';

@injectable()
export class ConfigService implements IConfigService {
  getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '0.1.0';
  }

  isFeatureEnabled(flag: string): boolean {
    const key = `VITE_FEATURE_${flag.toUpperCase()}`;
    return import.meta.env[key] === 'true';
  }

  getConfig(key: string): string | undefined {
    const prefixedKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    return import.meta.env[prefixedKey];
  }
}

// src/core/di-container.ts - Configure container
import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';
import type { IConfigService } from '../interfaces/IConfigService';
import { ConfigService } from '../services/ConfigService';

const container = new Container();

container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService).inSingletonScope();

export { container };

// src/App.tsx - Use in component
import { container } from './core/di-container';
import { TYPES } from './core/types';
import type { IConfigService } from './interfaces/IConfigService';

function App() {
  const configService = container.get<IConfigService>(TYPES.IConfigService);
  const version = configService.getAppVersion();
  // ... rest of component
}
```

**Important Notes:**

- `reflect-metadata` must be imported in `main.tsx` BEFORE any decorated classes are loaded
- TypeScript decorators require `experimentalDecorators: true` and `emitDecoratorMetadata: true` in tsconfig.app.json
- All services should be registered as singletons using `.inSingletonScope()`
- Type identifiers use `Symbol.for()` for better debugging

**Feature Flag System:**

The project now has a complete feature flag infrastructure for continuous delivery:

```typescript
// Check if a feature is enabled in any component
import { useFeatureFlag } from './hooks/useFeatureFlag';

function MyComponent() {
  const { isEnabled } = useFeatureFlag('FLOOR_PLAN');

  if (!isEnabled) return null;

  return <FloorPlan />;
}

// Get all flags (useful for debug/admin UIs)
import { useFeatureFlags } from './hooks/useFeatureFlag';

function AdminPanel() {
  const { flags, service } = useFeatureFlags();

  return Object.entries(flags).map(([name, enabled]) => (
    <div key={name}>
      {name}: {enabled ? 'ON' : 'OFF'}
    </div>
  ));
}

// Toggle flags programmatically (dev mode only)
const { service } = useFeatureFlag('SOME_FEATURE');
service.enable('FLOOR_PLAN');  // Stored in sessionStorage
service.disable('FLOOR_PLAN');
```

**Feature Flag Properties:**

- Defined in environment variables with `VITE_FEATURE_` prefix
- Runtime overrides stored in sessionStorage (dev mode only)
- Production mode blocks toggle operations
- DebugPanel component visualizes all flags (enabled with `DEBUG_PANEL` flag)
- Flag names normalized (case-insensitive, prefix optional)

**Before Adding New Services:**

1. Define interface in `src/interfaces/I*.ts`
2. Add type identifier to `src/core/types.ts`
3. Implement service with `@injectable()` decorator
4. Register in `src/core/di-container.ts`
5. Write comprehensive tests (unit tests for service, integration tests for container)
6. Use `container.get<IServiceName>(TYPES.IServiceName)` in consumers

**Before Adding New Features:**

1. Check [IMPLEMENTATION-PLAN.md](../docs/IMPLEMENTATION-PLAN.md) for planned iteration
2. Ensure feature has a corresponding feature flag
3. **Write tests first or alongside implementation** - 80% coverage is mandatory
4. Follow SOLID principles even before DI container exists

**Dependencies Planned for Future Iterations:**

- `zustand` + `immer` (Phase 1)
- `konva` + `react-konva` (Phase 3)
- `axios` (Phase 2)
- `@playwright/test` (Phase 5)
- `vite-plugin-pwa` (Phase 5)

---

## Current Implementation Details

### Tailwind CSS 4 Configuration

**Custom Theme Colors (defined in [tailwind.config.js](../tailwind.config.js)):**

```javascript
colors: {
  accent: {
    DEFAULT: '#ffb65c',
    light: '#ffc97d',
    dark: '#e5a352',
  },
  panel: {
    bg: '#090909',
    'bg-warm': '#1a1713',
    surface: '#121212',
    card: '#151515',
    border: '#1f1f1f',
    'border-light': '#2a2a2a',
  },
  text: {
    primary: '#eae7df',
    secondary: '#b9b6af',
    muted: '#8a8885',
  },

  // Legacy mappings for compatibility
  primary: {
    light: '#ffc97d',
    DEFAULT: '#ffb65c',
    dark: '#e5a352',
  },
  surface: {
    light: '#1a1713',
    DEFAULT: '#121212',
    dark: '#090909',
  },
}
```

**Usage Examples (Dashboard):**

- `bg-warm-gradient` - Warm dark background gradient
- `text-text-primary` / `text-text-secondary` / `text-text-muted` - Typography tokens
- `bg-panel-card` / `border-panel-border` - Surface and border tokens

**Dark Mode:**

- Class-based: `darkMode: 'class'`
- Toggle by adding/removing `dark` class on root element
- All components should support both light and dark modes

### Environment Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client.

**Current Variables ([.env.example](../.env.example)):**

```bash
VITE_APP_VERSION=0.1.0

# Home Assistant Connection
# VITE_HA_BASE_URL=http://homeassistant.local:8123
# VITE_HA_WEBSOCKET_URL=ws://homeassistant.local:8123/api/websocket
# VITE_HA_ACCESS_TOKEN=your_long_lived_access_token_here

# Feature Flags
VITE_FEATURE_NAVIGATION=false
VITE_FEATURE_DEBUG_PANEL=false
VITE_FEATURE_DEVICE_TRACKING=false
VITE_FEATURE_TRACKING_DEBUG_OVERLAY=false
VITE_FEATURE_COMPONENT_SHOWCASE=false
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

# Tracking debug overlay
# Controls what raw location values are shown next to each marker when
# VITE_FEATURE_TRACKING_DEBUG_OVERLAY=true.
# Allowed: xyz | geo
VITE_TRACKING_DEBUG_OVERLAY_MODE=xyz

# Tracking (ESPresense)
# Minimum confidence required to accept a device position update.
# Initial default: accept only when confidence > 69
VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE=69
```

### ESPresense / Presence Tracking Notes

When implementing or adjusting presence/location tracking features (especially ESPresense-backed flows), keep these conventions aligned with ESPresense Companion docs and common setup patterns:

- **Coordinate system:** Use meters. Default convention is origin `(0,0)` at the bottom-left of the mapped area, and all room/node coordinates measured from that origin.
- **Room geometry:** Keep polygon points in a consistent order (clockwise or counter-clockwise). Avoid overlaps/out-of-bounds coordinates.
- **Node placement:** Accuracy depends heavily on node placement (trilateration). Prefer nodes near corners of the floorplan plus at least one additional node, and aim for **5+ fixes** (nodes seeing a device) for better accuracy.
- **Max distance during setup:** ESPresense nodes often default to a max distance limit. During calibration/setup, setting max distance to `0` (no limit) can help ensure you receive all distance readings.
- **RSSI@1m calibration:** If distance circles are consistently too large/small versus reality, adjust the device’s RSSI@1m (small steps) and verify across multiple known locations.
- **Floor ordering:** If modeling multi-floor confidence, list floors for a node starting with the floor it’s on, followed by adjacent floors (helps avoid confusing “best scenario” selection).

For project-specific tracking design and constraints, also check:

- [docs/DEVICE-TRACKING.md](../docs/DEVICE-TRACKING.md)
- [docs/FEATURE-DEVICE-TRACKING-ESPRESENSE.md](../docs/FEATURE-DEVICE-TRACKING-ESPRESENSE.md)

### Device Tracking (ESPresense via Home Assistant)

Important project conventions from the most recent tracking work:

- **No new WebSocket connections:** reuse the existing HA client/services and the `state_changed` subscription.
- **People-driven labeling:** marker label comes from `person.*` (friendly name), not from MQTT/device-tracker raw ids.
- **People-only visibility:** only `device_tracker.*` entities assigned to a Person are rendered; unassigned trackers are automatically removed from the rendered set.
- **Canonical IDs + aliases:** multiple identifier formats (e.g. `irk:*`, `phone:*`) are canonicalized/aliased into a single device record; explicitly exclude `node:*` devices from tracking.
- **Live metadata updates:** when a person changes name or avatar, markers update via the same HA `state_changed` pipeline.

Where to look in the codebase:

- Tracking call-chain overview and file inventory: `docs/DEVICE-TRACKING.md`
- Location extraction/parsing: `src/features/tracking/espresense/*`
- Tracking service/controller wiring: `src/services/DeviceLocationTrackingService.ts` and `src/components/dashboard/DeviceLocationTrackingController.tsx`
- Marker rendering + debug overlay: `src/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx`

Marker avatar behavior:

- Markers render the **person image avatar** when available (`person.*.attributes.entity_picture`), otherwise fall back to **initials**.
- Debug overlay labels (xyz/geo) remain **dev-only** and are gated by feature flags (see `docs/DEVICE-TRACKING.md`).

### Prototype Marker Sizing / Alignment (SVG renderer)

If you’re adjusting marker sizing or avatar alignment in the SVG-based floorplan prototype renderer:

- The prototype runtime renderer lives in `public/scripts.js`.
- Pin scale is controlled by `DEVICE_PIN_SCALE`.
- Avatar overlay sizing/positioning is computed in SVG “user units” using a viewBox-aware `unitsPerPx` conversion (small numeric tweaks correspond to ~1–2 device pixels).

### Testing / Build Gotcha (TypeScript + JSX types)

If you see `TS2503: Cannot find namespace 'JSX'` (often in tests), prefer React types like `ReactElement` over `JSX.Element` in test helper return types.

**Access in Code:**

```typescript
const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
```

### TypeScript Configuration

**Strict Mode Enabled** ([tsconfig.app.json](../tsconfig.app.json)):

- `strict: true` - All strict checks enabled
- `noUnusedLocals: true` - Warn on unused variables
- `noUnusedParameters: true` - Warn on unused parameters
- `noFallthroughCasesInSwitch: true` - Prevent switch fallthrough bugs
- `noUncheckedSideEffectImports: true` - Catch side-effect imports

**Target:** ES2022 with modern browser support

---

## Critical Requirements

### 1. SOLID Principles (Non-Negotiable)

**ALL services must be interface-based:**

```typescript
// ✅ CORRECT
interface IWeatherService {
  getCurrentWeather(): Promise<Weather>;
}

@injectable()
class WeatherService implements IWeatherService {
  async getCurrentWeather(): Promise<Weather> {
    /* ... */
  }
}

// ❌ INCORRECT
class WeatherService {
  async getCurrentWeather() {
    /* ... */
  }
}
```

**Interface naming convention:** `IServiceName`

**Dependency injection is mandatory:**

- Use InversifyJS `@injectable()` decorator
- Constructor injection only
- No service locator pattern
- No static methods for business logic

### 2. TypeScript Strict Mode

**All code must pass TypeScript strict mode:**

- No implicit `any` types
- Explicit return types on functions
- Null/undefined checks required
- Strict property initialization

```typescript
// ✅ CORRECT
function calculateTemperature(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

// ❌ INCORRECT
function calculateTemperature(celsius) {
  return (celsius * 9) / 5 + 32;
}
```

### 3. Feature Flags

**Use feature flags for incomplete features:**

```typescript
// Environment variable
VITE_FEATURE_CLIMATE_OVERLAY = false;

// Usage
const { isEnabled } = useFeatureFlag('CLIMATE_OVERLAY');
if (!isEnabled) return null;
```

**Standard flags:**

- `FEATURE_FLOOR_PLAN` - 2D layout
- `FEATURE_HA_CONNECTION` - Home Assistant integration
- `FEATURE_OVERLAYS` - Overlay system
- `OVERLAY_LIGHTING` - Light controls
- `OVERLAY_CLIMATE` - Temperature/HVAC
- `OVERLAY_SURVEILLANCE` - Cameras/sensors
- `OVERLAY_AV` - Audio/visual devices
- `OVERLAY_NETWORK` - Network topology

### 4. Testing Requirements

**80% code coverage minimum:**

- Unit tests for all services
- Component tests with React Testing Library
- E2E tests for critical user flows
- Integration tests for API interactions

```typescript
// Test file naming
MyComponent.tsx;
MyComponent.test.tsx; // Component tests
MyService.ts;
MyService.test.ts; // Service tests
```

### 5. Accessibility (WCAG 2.2 AA)

**Required for all components:**

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus indicators visible
- 4.5:1 color contrast minimum
- Screen reader compatibility

```typescript
// ✅ CORRECT
<button aria-label="Toggle lights" onClick={handleToggle}>
  <LightIcon />
</button>

// ❌ INCORRECT
<div onClick={handleToggle}>
  <LightIcon />
</div>
```

---

## Code Style Guidelines

### Import Organization

**IMPORTANT:** Path aliases (`@/`) are NOT configured. Use relative imports.

```typescript
// Current: Use relative imports
import { useState, useEffect } from 'react';
import App from './App';
import './index.css';

// Recommended ordering for non-trivial modules
// 1. External dependencies
import { injectable, inject } from 'inversify';
import { useState, useEffect } from 'react';

// 2. Internal interfaces (alphabetically)
import type { IConfigService } from '../interfaces/IConfigService';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';

// 3. Internal implementations
import { container } from '../core/di-container';
import { TYPES } from '../core/types';

// 5. Styles
import './MyComponent.css';
```

### File Structure

**Current:**

```
src/
├── App.tsx                 # Root component (Dashboard-first)
├── main.tsx                # Entry point
├── index.css               # Global styles (Tailwind imports)
├── components/             # React components
│   ├── dashboard/          # Dashboard UI
│   └── ui/                 # UI primitives (e.g., Button, Dialog)
├── core/                   # DI container + type identifiers
├── hooks/                  # Custom hooks (feature flags)
├── interfaces/             # Service interfaces
├── services/               # Service implementations
└── assets/                 # Static assets
```

**Future (Phase 1+):**

```
src/
├── core/              # DI container, types
├── interfaces/        # Service interfaces (I*.ts)
├── services/          # Service implementations
├── components/        # React components
├── stores/            # Zustand stores
├── hooks/             # Custom React hooks
├── utils/             # Pure utility functions
├── types/             # TypeScript types/interfaces
├── constants/         # App constants
└── assets/            # Static assets
```

### Component Structure

```typescript
// 1. Imports (see above)

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

// 3. Component
export function MyComponent({ title, onAction }: MyComponentProps) {
  // 3a. Hooks
  const { isEnabled } = useFeatureFlag('FEATURE_NAME');
  const store = useAppStore();

  // 3b. State
  const [loading, setLoading] = useState(false);

  // 3c. Effects
  useEffect(() => {
    // ...
  }, []);

  // 3d. Handlers
  const handleClick = () => {
    // ...
  };

  // 3e. Early returns
  if (!isEnabled) return null;

  // 3f. Render
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

### Service Structure

```typescript
import { injectable, inject } from 'inversify';
import { IMyService } from '@/interfaces/IMyService';
import { IHttpClient } from '@/interfaces/IHttpClient';
import { TYPES } from '@/core/types';

@injectable()
export class MyService implements IMyService {
  constructor(@inject(TYPES.IHttpClient) private httpClient: IHttpClient) {}

  async myMethod(param: string): Promise<Result> {
    // Implementation
  }
}
```

---

## Common Patterns

### Zustand Store with Immer

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    theme: 'dark',
    setTheme: (theme) => {
      set((state) => {
        state.theme = theme;
      });
    },
  }))
);
```

### WebSocket with Reconnection

```typescript
interface IWebSocketService {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(event: string, handler: (data: unknown) => void): void;
}

@injectable()
export class WebSocketService implements IWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    // Implement with exponential backoff
  }
}
```

### Konva Floor Plan Component

```typescript
import { Stage, Layer, Rect, Text } from 'react-konva';

interface FloorPlanProps {
  rooms: Room[];
}

export function FloorPlan({ rooms }: FloorPlanProps) {
  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        {rooms.map((room) => (
          <Rect
            key={room.id}
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            fill={room.color}
          />
        ))}
      </Layer>
    </Stage>
  );
}
```

---

## Anti-Patterns to Avoid

### ❌ Service Without Interface

```typescript
// BAD
export class WeatherService {
  async getWeather() {
    /* ... */
  }
}
```

### ❌ Implicit Any Types

```typescript
// BAD
function process(data) {
  /* ... */
}
```

### ❌ Direct Service Instantiation

```typescript
// BAD
const service = new WeatherService();
```

### ❌ Props Spreading Without Types

```typescript
// BAD
function MyComponent(props) {
  return <div {...props} />;
}
```

### ❌ Side Effects in Render

```typescript
// BAD
function MyComponent() {
  fetch('/api/data'); // Don't fetch in render
  return <div>Content</div>;
}
```

---

## Documentation Requirements

### JSDoc for Public APIs

```typescript
/**
 * Fetches the current weather conditions from Home Assistant.
 *
 * @param location - The location identifier from HA
 * @returns Promise resolving to current weather data
 * @throws {ApiError} If the weather service is unavailable
 */
async getCurrentWeather(location: string): Promise<Weather> {
  // ...
}
```

### README Updates

When adding new features, update:

- Feature list in README.md
- Architecture examples if applicable
- Environment variables in .env.example
- Getting started instructions if setup changes

### Commit Messages

Follow Conventional Commits:

```
feat(overlay): add climate heat map visualization
fix(auth): resolve token refresh race condition
docs(api): document WebSocket event types
test(services): add weather service integration tests
refactor(store): migrate to Zustand from Context API
```

---

## Performance Guidelines

### Bundle Size Targets

- Initial bundle: < 250KB gzipped
- Lazy load routes and overlays
- Code splitting for each overlay system
- Dynamic imports for heavy dependencies

```typescript
// ✅ CORRECT - Lazy loading
const ClimateOverlay = lazy(() => import('./overlays/ClimateOverlay'));

// ❌ INCORRECT - Eager loading
import { ClimateOverlay } from './overlays/ClimateOverlay';
```

### Core Web Vitals Targets

- LCP (Largest Contentful Paint): < 2.5s
- INP (Interaction to Next Paint): < 200ms
- CLS (Cumulative Layout Shift): < 0.1

### Optimization Strategies

- Memoize expensive computations
- Virtualize long lists
- Debounce user input handlers
- Use `React.memo` for pure components
- Optimize Konva layers (static vs dynamic)

---

## Security Guidelines

### Environment Variables

```typescript
// ✅ CORRECT
const apiUrl = import.meta.env.VITE_HA_BASE_URL;

// ❌ INCORRECT - Hardcoded
const apiUrl = 'http://homeassistant.local:8123';
```

### API Token Handling

- Never log tokens
- Store in secure storage (not localStorage for production)
- Refresh tokens before expiry
- Clear on logout

### Content Security Policy

- No inline scripts in production
- Restrict external resource loading
- Use nonces for required inline styles

---

## Home Assistant Integration

### Entity State Structure

```typescript
interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}
```

### Service Call Pattern

```typescript
interface IHomeAssistantClient {
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<void>;
}

// Usage
await haClient.callService('light', 'turn_on', {
  entity_id: 'light.living_room',
  brightness: 255,
});
```

---

## CI/CD Considerations

### Pre-commit Checks

Every commit should pass:

- `pnpm lint` - ESLint checks
- `pnpm type-check` - TypeScript compilation
- `pnpm test` - Unit tests
- `pnpm format` - Prettier formatting

### Pull Request Requirements

- All CI checks passing
- 80% code coverage maintained
- No TypeScript errors
- Bundle size within limits
- At least 1 approval

---

## Resources

- [REQUIREMENTS.md](../docs/REQUIREMENTS.md) - Full project requirements
- [TECHNOLOGY-STACK.md](../docs/TECHNOLOGY-STACK.md) - Detailed tech decisions
- [DEVELOPMENT-STANDARDS.md](../DEVELOPMENT-STANDARDS.md) - Web standards reference
- [IMPLEMENTATION-PLAN.md](../docs/IMPLEMENTATION-PLAN.md) - Iteration roadmap
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

---

## Quick Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build (tsc -b + vite build)
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

---

**Remember:** This project prioritizes code quality, accessibility, and user experience. When in doubt, favor explicitness over brevity, and always follow SOLID principles.
