# Home Assistant Dashboard (hass-dash)

<!-- markdownlint-disable MD036 MD060 -->

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646cff.svg)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A sleek, modern Progressive Web Application (PWA) that serves as an intuitive visual companion to Home Assistant. Designed for non-technical residents and visitors to interact with their smart home through a beautiful 2D spatial interface.

![Project Status](https://img.shields.io/badge/status-iteration%200.1%20complete-green.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)

---

## Vision

While Home Assistant excels at managing services and resources behind the scenes, **hass-dash** focuses purely on end-user experience. It transforms complex home automation into an intuitive, glanceable interface where residents can:

- 🏠 **Visualize their home** in a 2D spatial layout
- 🌡️ **Monitor climate** with real-time heat maps
- 💡 **Control lighting, climate, and devices** with simple interactions
- 📹 **View security cameras** and presence detection
- ⚡ **Track energy production and consumption**
- 🔌 **Manage IoT devices** across multiple categories

All presented in a **minimalistic, color-coded interface** that makes sense at a glance.

**Current Status:** Foundation complete (DI + feature flags + HA connection + dashboard scaffold) ✅

---

## Running Locally

### Prerequisites

- **Node.js:** 20.19+ (required)
- **pnpm:** 9.x (required)
- **Git:** Latest version

To install pnpm globally:

```bash
npm install -g pnpm
```

### Installation Steps

1. **Clone the repository:**

   ```bash
   git clone https://github.com/GeekBlazed/hass-dash.git
   cd hass-dash
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   The default `.env` has all features disabled. To test features locally:

   ```bash
   cp .env.local.example .env.local
   ```

   `.env.local` overrides `.env` and is git-ignored for local testing.

4. **Start the development server:**

   ```bash
   pnpm dev
   ```

   Open your browser to [http://localhost:5173](http://localhost:5173)

### PWA Offline Troubleshooting (Localhost)

If you install from the Vite dev server and then stop it, you may see requests like `/@vite/client` and `/src/main.tsx` fail offline. That is expected: the dev HTML references Vite module URLs that are not a production precache target.

For reliable offline launch testing, install from a production preview build instead:

1. Run:
   - `pnpm pwa:offline-test`

1. Open exactly:
   - `http://localhost:5173`

1. Remove any previously installed localhost app and unregister old service workers for that origin.
1. Install the app from that page and launch it once while online to warm caches.
1. Stop the preview server and launch the installed app again.

Notes:

- `VITE_PWA_DEV_SW=true` is useful for service-worker behavior debugging during `pnpm dev`, but it is not a full replacement for preview/prod offline validation.
- If you still get `ERR_CONNECTION_REFUSED`, the app shortcut is likely pointing to a different localhost origin/port than the one you installed from.
- Production deployments already use the service worker and versioned precache by default.

### Testing From Another Machine (LAN / WSL2)

By default, the dev server is configured to listen on all interfaces (equivalent to `vite --host 0.0.0.0`).

1. Find the IP of the machine running Vite and browse to:
   - `http://<IP>:5173`

2. If you are running in **WSL2** and other machines cannot reach the dev server, this is usually Windows networking (WSL is listening, but Windows is not forwarding LAN traffic into WSL).

   In an **elevated PowerShell** (Run as Administrator) on Windows:
   - Allow inbound traffic to the dev port:

     ```powershell
     netsh advfirewall firewall add rule name="hass-dash (Vite dev 5173)" dir=in action=allow protocol=TCP localport=5173
     ```

   - Forward Windows port `5173` to the current WSL IP (replace `<WSL_IP>`):

     ```powershell
     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5173 connectaddress=<WSL_IP> connectport=5173
     ```

     To get the WSL IP from inside WSL:

     ```bash
     hostname -I | awk '{print $1}'
     ```

   - Browse from another machine using your **Windows LAN IP**:
     - `http://<WINDOWS_LAN_IP>:5173`

3. If the page loads but hot-reload (HMR) is flaky when accessed via LAN, set this in your local `.env`:
   - `VITE_DEV_HMR_HOST=<WINDOWS_LAN_IP>`

Notes:

- WSL IPs can change after restart; if they do, delete and re-add the portproxy rule.
- Remove the portproxy rule:

  ```powershell
  netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=5173
  ```

### Available Commands

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm build           # Build for production
pnpm preview         # Preview production build
pnpm pwa:offline-test # Build + preview for offline PWA install testing

# Code Quality
pnpm lint            # Run ESLint
pnpm format          # Format code with Prettier
pnpm format:check    # Check code formatting
pnpm type-check      # Run TypeScript type checking

# Testing (Coming in Iteration 0.2)
pnpm test            # Run tests in watch mode
pnpm test:run        # Run tests once
pnpm test:coverage   # Run tests with coverage report
pnpm test:e2e        # Run Playwright E2E tests
```

### What You'll See

After running `pnpm dev`, you'll see the welcome screen with:

- 🏠 Home Assistant Dashboard title
- Version number
- Development mode indicator
- Links to Documentation and GitHub

The app boots into the dashboard-first UI. Home Assistant and tracking features are gated behind feature flags and require HA configuration.

---

## Key Features

### 2D Spatial Interface

- Visual floor plan of your home with room locations and dimensions
- Multi-floor/multi-level support
- Geolocation and altitude integration
- Interactive pan and zoom

### Intelligent Overlay System

Toggle information layers on/off to minimize visual clutter:

- **Climate** - Temperature heat maps, humidity, HVAC status
- **Surveillance** - Cameras, motion sensors, door/window sensors, presence detection
- **Audio/Visual** - Speakers, microphones, displays, multi-room audio
- **Networking** - WiFi APs, ethernet drops, network topology

### Smart Home Integration

- **Lighting** - Status, brightness, color temperature, RGB control
- **Climate Control** - Indoor/outdoor conditions, thermostat, forecasts
- **Security** - Camera feeds, motion detection, package alerts
- **Energy Management** - Production, consumption, storage, solar/wind/geothermal
- **Location Tracking** - People and pets within the home
- **AI Assistants** - Integration with local assistants

### Progressive Web App

- Install on desktop and mobile
- Offline functionality with Last Known Good (LKG) values
- Fast, native-like performance
- Light, dark, and system color modes
- WCAG 2.2 Level AA accessibility

### Role-Based Access

- **Owner** - Full control, layout editing, user management
- **Resident** - Full monitoring and control
- **Visitor** - Limited monitoring, basic controls
- **Child** - Age-appropriate access with parental controls

---

## Technology Stack

This project is built with modern web technologies and strict architectural principles:

**Current Stack:**

- **Framework:** React 19.2.3 with TypeScript 5.9.3 (strict mode)
- **Build Tool:** Vite 7.3.0
- **Styling:** Tailwind CSS 4.1.18 with PostCSS
- **Code Quality:** ESLint 9.39.2, Prettier 3.7.4
- **Package Manager:** pnpm 10.26.1
- **Testing:** Vitest + React Testing Library (coverage gates in CI)
- **Dependency Injection:** InversifyJS + `reflect-metadata`
- **State Management:** Zustand (stores under `src/stores/*`)
- **Home Assistant Integration:** HTTP + WebSocket (feature-flagged)

**Coming in Future Iterations:**

- **2D Visualization:** Konva.js / React-Konva
- **UI Components:** Radix UI (accessible primitives)
- **PWA:** Vite PWA Plugin with Workbox
- **HTTP Client:** Axios with interceptors
- **Real-time:** Native WebSocket with reconnection logic

See [TECHNOLOGY-STACK.md](docs/TECHNOLOGY-STACK.md) for detailed rationale and configuration.

---

## Project Structure

```text
hass-dash/
├── .github/                  # GitHub configuration
│   └── copilot-instructions.md
├── .vscode/                  # VS Code workspace settings
│   ├── settings.json
│   ├── extensions.json
│   ├── launch.json
│   ├── tasks.json
│   └── hass-dash.code-snippets
├── public/                   # Static assets
├── src/                      # Source code
│   ├── App.tsx              # Main application component
│   ├── index.css            # Global styles (Tailwind directives)
│   └── main.tsx             # Application entry point
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── .prettierrc              # Prettier configuration
├── eslint.config.js         # ESLint configuration
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite configuration
```

---

## Architecture Principles

This project follows strict architectural patterns:

### SOLID Principles (Strictly Enforced)

```typescript
// ✅ CORRECT: Service behind interface
interface IWeatherService {
  getCurrentWeather(): Promise<WeatherData>;
}

class HomeAssistantWeatherService implements IWeatherService {
  // Implementation
}

class WeatherOverlay {
  constructor(private weatherService: IWeatherService) {}
}
```

```typescript
// ❌ INCORRECT: Direct dependency
class WeatherOverlay {
  constructor(private weatherService: HomeAssistantWeatherService) {}
}
```

### Dependency Injection

All services use constructor injection via InversifyJS:

```typescript
@injectable()
class MyService {
  constructor(@inject('IWeatherService') private weatherService: IWeatherService) {}
}
```

### Testing Requirements

- **Unit Tests:** All functions, classes, modules
- **Integration Tests:** Service interactions
- **Component Tests:** UI components with mocked dependencies
- **E2E Tests:** Critical user flows

**No PR will be merged without appropriate tests and 80% global branch coverage.**

---

## Development Philosophy

### Ship-It-Today CI/CD Model

- **Main branch is always deployable** - Every commit on main goes to production
- **Small, incremental changes** - PRs focused and reviewable in < 30 minutes
- **Feature flags** - Hide incomplete features behind flags
- **Test before merge** - All changes must have appropriate test coverage
- **Fail fast** - Automated checks catch issues immediately

See [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) for the complete iteration roadmap (35+ iterations).

---

## Documentation

- [**REQUIREMENTS.md**](docs/REQUIREMENTS.md) - Comprehensive project requirements and design decisions
- [**DEVELOPMENT-STANDARDS.md**](DEVELOPMENT-STANDARDS.md) - Web standards, accessibility, security, performance guidelines
- [**TECHNOLOGY-STACK.md**](docs/TECHNOLOGY-STACK.md) - Technology choices with rationale and examples
- [**IMPLEMENTATION-PLAN.md**](docs/IMPLEMENTATION-PLAN.md) - Complete iteration roadmap (35+ micro-releases)
- [**CONTRIBUTING.md**](CONTRIBUTING.md) - How to contribute to this project

---

## Contributing

We welcome contributions! This project strictly enforces:

- ✅ **SOLID principles** - All services must sit behind interfaces
- ✅ **Automated testing** - 80% minimum coverage required
- ✅ **Modern web standards** - WCAG 2.2, PWA, ES2020+
- ✅ **TypeScript strict mode** - Type safety throughout

**All changes must go through pull requests.** Direct pushes to `main` are not allowed.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Security

This project handles sensitive home automation data. Security is paramount:

- HTTPS/TLS required for all production deployments
- Content Security Policy (CSP) enforcement
- No credentials in localStorage
- Input sanitization
- Regular dependency updates
- OWASP Top 10 compliance

**To report security vulnerabilities,** please email: [security contact TBD]

**Do NOT open public issues for security concerns.**

---

## Accessibility

WCAG 2.2 Level AA compliance is **required** for all features:

- Keyboard navigation for all interactive elements
- Color contrast ratios: 4.5:1 minimum
- Alt text for all images
- Proper form labels and ARIA attributes
- Screen reader testing required

---

## Performance Targets

- **Initial Load:** < 3 seconds on 3G
- **Time to Interactive:** < 5 seconds
- **Bundle Size:** < 250KB gzipped (initial)
- **Lighthouse Score:** 90+ (all categories)
- **Core Web Vitals:** Green for LCP, INP, CLS

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

The MIT License provides maximum flexibility for community contributions and adoption while being compatible with Home Assistant's Apache 2.0 license.

---

## Roadmap

### Phase 0-2: Foundation → HA Connection

- ✅ Project scaffolding (Vite + React + TS + Tailwind)
- ✅ Testing + coverage gates (Vitest + RTL)
- ✅ CI checks (lint/test/build)
- ✅ Dependency injection + feature flags
- ✅ Home Assistant connection (HTTP + WebSocket) + entity subscription pipeline

### Phase 3: Floor Plan Foundation (Week 4-5)

- ⏳ Floor Plan Data Model (JSON/TypeScript)
- ⏳ Konva Setup & Basic Canvas
- ⏳ Room Rendering
- ⏳ Multi-Floor Navigation

### Phase 4: First Overlay - Lighting (Week 5-6)

- ⏳ Overlay System Architecture
- ⏳ Device Placement on Floor Plan
- ⏳ Light Control
- ⏳ Light Details Panel

### Phase 5: Polish & PWA (Week 6-7)

- ⏳ PWA Configuration
- ⏳ Offline Support (LKG values)
- ⏳ Performance Optimization
- ⏳ User Onboarding

See [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) for complete roadmap with 35+ iterations.

---

## Acknowledgments

- **Home Assistant** - The amazing home automation platform this app connects to
- **Open Source Community** - For the incredible tools and libraries we build upon

---

## Support & Community

- **Issues:** [GitHub Issues](https://github.com/GeekBlazed/hass-dash/issues)
- **Discussions:** [GitHub Discussions](https://github.com/GeekBlazed/hass-dash/discussions)
- **Documentation:** [Project Wiki](https://github.com/GeekBlazed/hass-dash/wiki)

---

## Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ for the Home Assistant community**
