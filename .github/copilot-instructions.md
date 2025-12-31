# GitHub Copilot Instructions - hass-dash

## Project Overview

**Project:** Home Assistant Dashboard (hass-dash)  
**Type:** Progressive Web Application (PWA)  
**Tech Stack:** React 19.2, TypeScript (strict), Vite 7.2, Tailwind CSS 4  
**Architecture:** SOLID principles with InversifyJS for dependency injection  
**License:** MIT  
**Current Status:** Iteration 0.4 Complete - Dependency Injection Setup ✅

This is a visual, user-friendly front-end companion to Home Assistant. The application will provide a 2D spatial interface for monitoring and controlling smart home devices through various overlay systems (lighting, climate, surveillance, AV, networking).

**What's Implemented:**

- ✅ Vite + React + TypeScript setup with strict mode
- ✅ Tailwind CSS 4 with dark mode support
- ✅ ESLint + Prettier configuration
- ✅ Welcome screen (see [App.tsx](../src/App.tsx))
- ✅ Environment variable support
- ✅ Vitest testing framework with React Testing Library
- ✅ Coverage reporting with 80% thresholds
- ✅ GitHub Actions CI workflow
- ✅ InversifyJS DI container with example service (ConfigService)
- ✅ TypeScript decorators enabled for DI

**Not Yet Implemented:**

- ⏳ Feature flag service (Iteration 0.5)
- ⏳ State management with Zustand (Phase 1)
- ⏳ Konva.js floor plans (Phase 3)
- ⏳ Home Assistant integration (Phase 2)

See [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) for detailed roadmap.

---

## Working with Iteration 0.4

**Current Codebase State:**

- Basic Vite + React scaffold with TypeScript strict mode
- Welcome screen ([App.tsx](../src/App.tsx)) showing project info and links
- Tailwind CSS 4 configured with custom theme colors (see [tailwind.config.js](../tailwind.config.js))
- Environment variables in `.env.example` (all features disabled)
- ESLint with flat config using typescript-eslint
- **Vitest testing framework** with React Testing Library
- **Test coverage reporting** with 80% minimum thresholds
- **GitHub Actions CI** running tests, linting, and builds
- **InversifyJS DI container** ([di-container.ts](../src/core/di-container.ts)) with type identifiers ([types.ts](../src/core/types.ts))
- **Example service implementation:** ConfigService with interface and comprehensive tests
- **TypeScript decorators enabled** in tsconfig.app.json
- No state management library yet (Zustand coming in Phase 1)

**DI Container Setup:**

The project now has a fully functional dependency injection system using InversifyJS:

```typescript
// src/core/types.ts - Define type identifiers
export const TYPES = {
  IConfigService: Symbol.for('IConfigService'),
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

**Before Adding New Services:**

1. Define interface in `src/interfaces/I*.ts`
2. Add type identifier to `src/core/types.ts`
3. Implement service with `@injectable()` decorator
4. Register in `src/core/di-container.ts`
5. Write comprehensive tests (unit tests for service, integration tests for container)
6. Use `container.get<IServiceName>(TYPES.IServiceName)` in consumers

**Before Adding New Features:**

1. Check [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) for planned iteration
2. Ensure feature has a corresponding feature flag
3. **Write tests first or alongside implementation** - 80% coverage is mandatory
4. Follow SOLID principles even before DI container exists

**Dependencies to Add in Future Iterations:**

- `inversify` + `reflect-metadata` (Iteration 0.4)
- `zustand` + `immer` (Phase 1)
- `konva` + `react-konva` (Phase 3)
- `axios` (Phase 2)
- `@playwright/test` (Phase 5)

---

## Current Implementation Details

### Tailwind CSS 4 Configuration

**Custom Theme Colors (defined in [tailwind.config.js](../tailwind.config.js)):**

```javascript
colors: {
  primary: {
    light: '#5c6bc0',
    DEFAULT: '#3f51b5',
    dark: '#303f9f',
  },
  surface: {
    light: '#ffffff',
    DEFAULT: '#f5f5f5',
    dark: '#121212',
  },
}
```

**Usage Examples from Welcome Screen:**

- `text-primary` - Uses #3f51b5
- `dark:text-primary-light` - Uses #5c6bc0 in dark mode
- `bg-primary hover:bg-primary-dark` - Button states
- `from-surface-light to-gray-100` - Gradient backgrounds

**Dark Mode:**

- Class-based: `darkMode: 'class'`
- Toggle by adding/removing `dark` class on root element
- All components should support both light and dark modes

### Environment Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client.

**Current Variables ([.env.example](../.env.example)):**

```bash
VITE_APP_VERSION=0.1.0          # Shown in welcome screen
VITE_FEATURE_FLOOR_PLAN=false   # All features currently disabled
VITE_HA_BASE_URL=               # Not configured yet
```

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

**IMPORTANT:** Path aliases (`@/`) are NOT YET configured. Use relative imports until Iteration 0.4.

```typescript
// Current (Iteration 0.1): Use relative imports
import { useState, useEffect } from 'react';
import App from './App';
import './index.css';

// Future (Iteration 0.4+): After DI setup
// 1. External dependencies
import { injectable, inject } from 'inversify';
import { useState, useEffect } from 'react';

// 2. Internal interfaces (alphabetically)
import type { IHomeAssistantClient } from '@/interfaces/IHomeAssistantClient';
import type { IWeatherService } from '@/interfaces/IWeatherService';

// 3. Internal implementations
import { TYPES } from '@/core/types';

// 4. Types and constants
import type { Weather } from '@/types/Weather';
import { API_ENDPOINTS } from '@/constants/api';

// 5. Styles
import './MyComponent.css';
```

### File Structure

**Current (Iteration 0.1):**

```
src/
├── App.tsx           # Main app component (welcome screen)
├── main.tsx          # Entry point
├── index.css         # Global styles (Tailwind imports)
└── assets/           # Static assets
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

- [REQUIREMENTS.md](../REQUIREMENTS.md) - Full project requirements
- [TECHNOLOGY-STACK.md](../TECHNOLOGY-STACK.md) - Detailed tech decisions
- [DEVELOPMENT-STANDARDS.md](../DEVELOPMENT-STANDARDS.md) - Web standards reference
- [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) - Iteration roadmap
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

---

## Quick Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build           # Production build (tsc + vite build)
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
