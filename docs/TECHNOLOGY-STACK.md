# Technology Stack Recommendations

<!-- markdownlint-disable MD036 MD060 -->

**Project:** Home Assistant Dashboard (hass-dash)  
**Version:** 1.0  
**Date:** December 31, 2025

---

## Executive Summary

After analyzing the project requirements—strict SOLID principles, interface-based architecture, PWA capabilities, 2D spatial visualization, real-time updates, and comprehensive testing—the recommended technology stack prioritizes:

1. **Strong TypeScript support** for type safety and SOLID enforcement
2. **Robust dependency injection** for service abstraction requirements
3. **Excellent performance** for real-time updates and spatial rendering
4. **Mature ecosystem** for PWA, testing, and component libraries
5. **Long-term maintainability** with active community support

---

## Core Framework & Build Tool

### Recommended: React 18+ with Vite

**Rationale:**

- **Best-in-class TypeScript support** with strict mode compatibility
- **Largest ecosystem** for visualization libraries, component libraries, and tooling
- **Excellent DI support** via InversifyJS or TSyringe
- **Mature testing ecosystem** (Vitest, React Testing Library, Playwright)
- **Strong PWA capabilities** through Vite PWA plugin
- **Active development** and long-term stability
- **Performance** with concurrent features and automatic batching

**Alternative Considered:** Angular

- Strong DI built-in, but heavier bundle size and steeper learning curve
- Better for enterprise teams already familiar with Angular
- React provides better balance of power and flexibility for this project

**Build Tool:** Vite 5+

- Lightning-fast HMR (Hot Module Replacement)
- Optimized production builds with Rollup
- Native ESM support
- Excellent TypeScript integration
- Built-in PWA support via plugin

---

## Dependency Injection Container

### Recommended: InversifyJS

**Rationale:**

- Full-featured IoC (Inversion of Control) container
- Decorator-based API aligns with TypeScript ecosystem
- Excellent documentation and mature project
- Supports all SOLID principles out of the box
- Constructor injection, property injection, method injection
- Middleware and activation hooks for advanced scenarios

**Installation:**

```bash
npm install inversify reflect-metadata
```

**Example Configuration:**

```typescript
// di-container.ts
import { Container } from 'inversify';
import { IWeatherService } from './interfaces/IWeatherService';
import { HomeAssistantWeatherService } from './services/HomeAssistantWeatherService';

const container = new Container();

container
  .bind<IWeatherService>('IWeatherService')
  .to(HomeAssistantWeatherService)
  .inSingletonScope();

export { container };
```

**Alternative:** TSyringe (Microsoft)

- Lighter weight but less feature-rich
- Good option if you want simpler DI patterns

---

## State Management

### Recommended: Zustand with Immer

**Rationale:**

- **Minimal boilerplate** compared to Redux
- **Excellent TypeScript support**
- **Small bundle size** (~1KB)
- **Built-in DevTools** support
- **Middleware ecosystem** for persistence, subscriptions
- **Works seamlessly with DI** - stores can be injected as services
- **Immer integration** ensures immutable updates

**Installation:**

```bash
npm install zustand immer
```

**Example Store:**

```typescript
// stores/entity-store.ts
import create from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

interface EntityState {
  entities: Map<string, Entity>;
  updateEntity: (id: string, data: Partial<Entity>) => void;
  clearStaleEntities: () => void;
}

export const useEntityStore = create<EntityState>()(
  persist(
    immer((set) => ({
      entities: new Map(),
      updateEntity: (id, data) =>
        set((state) => {
          const entity = state.entities.get(id);
          if (entity) {
            state.entities.set(id, { ...entity, ...data });
          }
        }),
      clearStaleEntities: () =>
        set((state) => {
          const now = Date.now();
          for (const [id, entity] of state.entities) {
            if (now - entity.lastUpdate > 300000) {
              // 5 minutes
              state.entities.delete(id);
            }
          }
        }),
    })),
    { name: 'entity-cache' }
  )
);
```

**Alternative:** Jotai

- Atomic state management
- Great for avoiding prop drilling
- More granular than Zustand

---

## 2D Spatial Visualization

### Recommended: Konva.js with React-Konva

**Rationale:**

- **Canvas-based rendering** for excellent performance with many elements
- **React integration** via react-konva
- **Interactive 2D graphics** - pan, zoom, drag-and-drop built-in
- **Event handling** for interactive floor plans
- **Layering support** perfect for overlay system
- **Shape primitives** for rooms, sensors, devices
- **Export capabilities** for sharing floor plans

**Installation:**

```bash
npm install konva react-konva
```

**Example Floor Plan Component:**

```typescript
// components/FloorPlan.tsx
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import { Room, Device } from '../types';

interface FloorPlanProps {
  rooms: Room[];
  devices: Device[];
  activeOverlays: string[];
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  rooms,
  devices,
  activeOverlays
}) => {
  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer name="structure">
        {rooms.map(room => (
          <Rect
            key={room.id}
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            fill="#f0f0f0"
            stroke="#333"
            strokeWidth={2}
          />
        ))}
      </Layer>

      {activeOverlays.includes('devices') && (
        <Layer name="devices">
          {devices.map(device => (
            <Circle
              key={device.id}
              x={device.x}
              y={device.y}
              radius={10}
              fill={device.status === 'on' ? '#4caf50' : '#ccc'}
              draggable
            />
          ))}
        </Layer>
      )}
    </Stage>
  );
};
```

**Alternative:** PixiJS

- WebGL-based, even faster for very complex scenes
- More low-level, requires more custom code
- Consider for performance optimization if needed

**Alternative:** SVG + D3.js

- Easier debugging (inspect elements)
- Better for simple, static layouts
- Performance issues with many interactive elements

---

## UI Component Library

### Recommended: Radix UI + Tailwind CSS

**Rationale:**

- **Radix UI Primitives:**
  - Unstyled, accessible components (WCAG compliant)
  - Full keyboard navigation
  - ARIA attributes built-in
  - Composable and customizable
  - Small bundle impact (tree-shakeable)
- **Tailwind CSS:**
  - Utility-first CSS for rapid development
  - Excellent dark mode support
  - Custom theming via configuration
  - Minimal CSS bundle with PurgeCSS
  - CSS variables for dynamic theming

**Installation:**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-switch
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Theme Configuration:**

```typescript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
};
```

**Alternative:** Shadcn/ui

- Built on Radix UI + Tailwind
- Pre-styled components
- Copy-paste approach (not a dependency)
- Excellent for rapid prototyping

**Alternative:** Material UI (MUI)

- Comprehensive component library
- Strong theming system
- Larger bundle size
- May be harder to achieve custom minimalist design

---

## Testing Framework

### Recommended: Vitest + React Testing Library + Playwright

**Testing Stack:**

1. **Vitest** - Unit & Integration Testing
   - Vite-native (same config, fast)
   - Jest-compatible API
   - Built-in TypeScript support
   - Excellent watch mode
   - Coverage with c8

2. **React Testing Library** - Component Testing
   - Tests behavior, not implementation
   - Encourages accessibility
   - Works with Vitest

3. **Playwright** - E2E Testing
   - Cross-browser testing
   - Fast and reliable
   - Built-in retry and wait logic
   - Excellent debugging tools

**Installation:**

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
```

**Example Test Configuration:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
```

**Example Unit Test:**

```typescript
// services/__tests__/weather-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { HomeAssistantWeatherService } from '../HomeAssistantWeatherService';
import { IHomeAssistantClient } from '../../interfaces/IHomeAssistantClient';

describe('HomeAssistantWeatherService', () => {
  it('should fetch current weather', async () => {
    const mockClient: IHomeAssistantClient = {
      getState: vi.fn().mockResolvedValue({
        state: '72',
        attributes: { unit_of_measurement: '°F' },
      }),
    };

    const service = new HomeAssistantWeatherService(mockClient);
    const weather = await service.getCurrentWeather();

    expect(weather.temperature).toBe(72);
    expect(mockClient.getState).toHaveBeenCalledWith('weather.home');
  });
});
```

---

## PWA & Offline Support

### Recommended: Vite PWA Plugin + Workbox

**Rationale:**

- **Zero-config PWA** with sensible defaults
- **Workbox strategies** for sophisticated caching
- **Auto-generates** service worker and manifest
- **TypeScript support** for service worker code
- **Development mode** for testing offline

**Installation:**

```bash
npm install -D vite-plugin-pwa
```

**Configuration:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Home Assistant Dashboard',
        short_name: 'HassDash',
        description: 'Visual companion app for Home Assistant',
        theme_color: '#3f51b5',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.home-assistant\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'home-assistant-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
});
```

---

## Real-time Communication

### Recommended: Native WebSocket with Reconnection Logic

**Rationale:**

- **No overhead** of Socket.IO for this use case
- **Home Assistant WebSocket API** is well-documented
- **Full control** over connection management
- **TypeScript-friendly** custom implementation

**WebSocket Service:**

```typescript
// services/websocket-service.ts
import { injectable, inject } from 'inversify';
import { IWebSocketService } from '../interfaces/IWebSocketService';
import { IConnectionConfig } from '../interfaces/IConnectionConfig';

@injectable()
export class HomeAssistantWebSocketService implements IWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private messageId = 1;

  constructor(@inject('IConnectionConfig') private config: IConnectionConfig) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.websocketUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectDelay = 1000;
        this.authenticate().then(resolve).catch(reject);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.connect();
        }, this.reconnectDelay);
      };
    });
  }

  private async authenticate(): Promise<void> {
    this.send({
      type: 'auth',
      access_token: this.config.accessToken,
    });
  }

  send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          id: this.messageId++,
          ...message,
        })
      );
    }
  }

  private handleMessage(message: any): void {
    // Emit to subscribers based on message type
  }
}
```

---

## HTTP Client

### Recommended: Axios

**Rationale:**

- **Interceptors** for authentication and error handling
- **TypeScript support** with generics
- **Request/response transformation**
- **Cancel tokens** for cleanup
- **Timeout configuration**
- **Automatic JSON parsing**

**Installation:**

```bash
npm install axios
```

**HTTP Client Service:**

```typescript
// services/http-client.ts
import axios, { AxiosInstance } from 'axios';
import { injectable, inject } from 'inversify';
import { IHttpClient } from '../interfaces/IHttpClient';
import { IAuthService } from '../interfaces/IAuthService';

@injectable()
export class HomeAssistantHttpClient implements IHttpClient {
  private client: AxiosInstance;

  constructor(@inject('IAuthService') private authService: IAuthService) {
    this.client = axios.create({
      baseURL: process.env.VITE_HA_BASE_URL,
      timeout: 10000,
    });

    // Request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const token = this.authService.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.authService.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }

  async post<T>(url: string, data: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }
}
```

**Alternative:** Native Fetch API

- No dependencies
- More verbose error handling
- Consider for bundle size optimization

---

## Code Quality Tools

### Recommended Stack

**ESLint Configuration:**

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint-plugin-react eslint-plugin-react-hooks
npm install -D eslint-plugin-jsx-a11y
```

**.eslintrc.json:**

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "react/react-in-jsx-scope": "off"
  }
}
```

**Prettier Configuration:**

```bash
npm install -D prettier eslint-config-prettier
```

**.prettierrc:**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

**Husky + lint-staged:**

```bash
npm install -D husky lint-staged
npx husky install
```

**package.json:**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

---

## Package Manager

### Recommended: pnpm

**Rationale:**

- **Disk space efficiency** - shared dependency storage
- **Faster installations** than npm/yarn
- **Strict node_modules** prevents phantom dependencies
- **Workspace support** for monorepo potential
- **Compatible** with npm registry

**Installation:**

```bash
npm install -g pnpm
```

**Alternative:** npm

- Included with Node.js
- Simpler for contributors
- Slower but more familiar

---

## Development Tools

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense"
  ]
}
```

---

## Building Layout Definition

### Recommended: JSON with TypeScript Types

**Rationale:**

- **Type safety** with TypeScript interfaces
- **Easy to parse** and validate
- **Version control friendly**
- **Can generate from YAML** if users prefer authoring in YAML
- **JSON Schema** for validation and IDE support

**Example Layout Schema:**

```typescript
// types/floor-plan.ts
export interface FloorPlan {
  version: string;
  name: string;
  geolocation: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  floors: Floor[];
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  rooms: Room[];
}

export interface Room {
  id: string;
  name: string;
  type: 'bedroom' | 'kitchen' | 'bathroom' | 'living' | 'office' | 'other';
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  devices: DevicePlacement[];
}

export interface DevicePlacement {
  entityId: string;
  x: number;
  y: number;
}
```

**Example Layout File:**

```json
{
  "version": "1.0",
  "name": "My Home",
  "geolocation": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "altitude": 10
  },
  "floors": [
    {
      "id": "main",
      "name": "Main Floor",
      "level": 0,
      "rooms": [
        {
          "id": "living-room",
          "name": "Living Room",
          "type": "living",
          "coordinates": {
            "x": 0,
            "y": 0,
            "width": 400,
            "height": 300
          },
          "devices": [
            {
              "entityId": "light.living_room_main",
              "x": 200,
              "y": 150
            }
          ]
        }
      ]
    }
  ]
}
```

**Future Enhancement:** Visual editor (Phase 2)

- Drag-and-drop room editor
- Device placement tool
- Export to JSON

---

## Authentication

### Recommended: Home Assistant Long-Lived Access Token

**Rationale:**

- **Standard Home Assistant auth** method
- **Simple implementation** for initial release
- **Secure storage** in httpOnly cookies (server-side) or encrypted localStorage

**Auth Service:**

```typescript
// services/auth-service.ts
import { injectable } from 'inversify';
import { IAuthService } from '../interfaces/IAuthService';

@injectable()
export class HomeAssistantAuthService implements IAuthService {
  private readonly TOKEN_KEY = 'ha_access_token';

  async login(token: string, baseUrl: string): Promise<boolean> {
    try {
      // Verify token with Home Assistant
      const response = await fetch(`${baseUrl}/api/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        this.setToken(token);
        this.setBaseUrl(baseUrl);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('ha_base_url');
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  private setBaseUrl(url: string): void {
    localStorage.setItem('ha_base_url', url);
  }
}
```

**Future Enhancement:** OAuth2 flow

- More secure for production
- Better user experience
- Support for refresh tokens

---

## Environment Configuration

### Recommended: Vite env variables

**`.env.example`:**

```bash
VITE_HA_BASE_URL=http://homeassistant.local:8123
VITE_HA_WEBSOCKET_URL=ws://homeassistant.local:8123/api/websocket
VITE_MQTT_BROKER_URL=ws://mqtt.local:9001
```

**Type-safe env variables:**

```typescript
// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HA_BASE_URL: string;
  readonly VITE_HA_WEBSOCKET_URL: string;
  readonly VITE_MQTT_BROKER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Complete Package.json

```json
{
  "name": "hass-dash",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "prepare": "husky install"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-konva": "^18.2.10",
    "konva": "^9.3.0",
    "zustand": "^4.5.0",
    "immer": "^10.0.3",
    "inversify": "^6.0.2",
    "reflect-metadata": "^0.2.1",
    "axios": "^1.6.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-toast": "^1.1.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@vitest/ui": "^1.2.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "@playwright/test": "^1.40.1",
    "autoprefixer": "^10.4.17",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-jsx-a11y": "^6.8.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "husky": "^8.0.3",
    "jsdom": "^24.0.0",
    "lint-staged": "^15.2.0",
    "postcss": "^8.4.33",
    "prettier": "^3.2.4",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "vite-plugin-pwa": "^0.17.4",
    "vitest": "^1.2.0",
    "@vitest/coverage-c8": "^0.33.0"
  }
}
```

---

## Project Structure

```text
hass-dash/
├── public/
│   ├── manifest.json
│   ├── robots.txt
│   └── icons/
├── src/
│   ├── assets/          # Images, fonts
│   ├── components/      # React components
│   │   ├── floor-plan/
│   │   ├── overlays/
│   │   ├── ui/
│   │   └── layout/
│   ├── core/            # Core utilities
│   │   ├── di-container.ts
│   │   └── constants.ts
│   ├── hooks/           # Custom React hooks
│   ├── interfaces/      # TypeScript interfaces
│   │   ├── services/
│   │   └── types/
│   ├── services/        # Service implementations
│   │   ├── auth/
│   │   ├── home-assistant/
│   │   ├── mqtt/
│   │   └── storage/
│   ├── stores/          # Zustand stores
│   ├── styles/          # Global styles
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── App.tsx
│   ├── main.tsx
│   └── env.d.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── index.html
├── package.json
├── playwright.config.ts
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Summary

| Category             | Technology                | Rationale                                       |
| -------------------- | ------------------------- | ----------------------------------------------- |
| **Framework**        | React 18+                 | Best ecosystem, TypeScript support, DI-friendly |
| **Build Tool**       | Vite 5+                   | Fast, modern, great DX, PWA support             |
| **DI Container**     | InversifyJS               | Full IoC, SOLID enforcement                     |
| **State Management** | Zustand + Immer           | Simple, performant, TypeScript-friendly         |
| **2D Visualization** | Konva.js                  | Canvas-based, interactive, performant           |
| **UI Components**    | Radix UI + Tailwind       | Accessible, customizable, modern                |
| **Testing**          | Vitest + RTL + Playwright | Fast, comprehensive, reliable                   |
| **PWA**              | Vite PWA Plugin           | Zero-config, Workbox integration                |
| **HTTP**             | Axios                     | Interceptors, TypeScript support                |
| **WebSocket**        | Native + Custom           | Full control, no overhead                       |
| **Package Manager**  | pnpm                      | Fast, efficient, strict                         |
| **Code Quality**     | ESLint + Prettier + Husky | Consistent, automated                           |

---

## Next Steps

1. **Initialize Project:**

   ```bash
   pnpm create vite hass-dash --template react-ts
   cd hass-dash
   pnpm install
   ```

2. **Install Core Dependencies:**

   ```bash
   pnpm add inversify reflect-metadata zustand immer axios
   pnpm add react-konva konva
   pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu
   ```

3. **Install Dev Dependencies:**

   ```bash
   pnpm add -D tailwindcss postcss autoprefixer
   pnpm add -D vitest @vitest/ui @testing-library/react
   pnpm add -D @playwright/test
   pnpm add -D vite-plugin-pwa
   pnpm add -D eslint prettier husky lint-staged
   ```

4. **Configure Tools:** Set up config files as shown above

5. **Set Up DI Container:** Create initial service interfaces and implementations

6. **Create Project Structure:** Set up folders and initial files

---

## Document Version

**Version:** 1.0  
**Date:** December 31, 2025  
**Status:** Recommended (Pending Approval)

This document should be reviewed and updated as the project evolves and new technologies emerge.
