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

**Current Status:** Iteration 0.1 - Project Scaffolding Complete ✅

---

## Running Locally

### Prerequisites

- **Node.js:** 20.x or later (LTS recommended)
- **pnpm:** 8.x or later
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

### Available Commands

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm build           # Build for production
pnpm preview         # Preview production build

# Code Quality
pnpm lint            # Run ESLint
pnpm format          # Format code with Prettier
pnpm format:check    # Check code formatting
pnpm type-check      # Run TypeScript type checking

# Testing (Coming in Iteration 0.2)
pnpm test            # Run unit tests
pnpm test:coverage   # Run tests with coverage report
```

### What You'll See

After running `pnpm dev`, you'll see the welcome screen with:

- 🏠 Home Assistant Dashboard title
- Version number
- Development mode indicator
- Links to Documentation and GitHub

This is Iteration 0.1 - a basic scaffolded project demonstrating that the development environment is working correctly.

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
- **AI Assistants** - Integration with Alexa, Google Home, local assistants

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

**Current Stack (Iteration 0.1):**

- **Framework:** React 19.2.3 with TypeScript 5.9.3 (strict mode)
- **Build Tool:** Vite 7.3.0
- **Styling:** Tailwind CSS 4.1.18 with PostCSS
- **Code Quality:** ESLint 9.39.2, Prettier 3.7.4
- **Package Manager:** pnpm 10.26.1

**Coming in Future Iterations:**

- **State Management:** Zustand + Immer
- **Dependency Injection:** InversifyJS (SOLID principles enforced)
- **2D Visualization:** Konva.js / React-Konva
- **UI Components:** Radix UI (accessible primitives)
- **Testing:** Vitest + React Testing Library + Playwright
- **PWA:** Vite PWA Plugin with Workbox
- **HTTP Client:** Axios with interceptors
- **Real-time:** Native WebSocket with reconnection logic

See [TECHNOLOGY-STACK.md](TECHNOLOGY-STACK.md) for detailed rationale and configuration.

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

**No PR will be merged without appropriate tests and 80% coverage.**

---

## Development Philosophy

### Ship-It-Today CI/CD Model

- **Main branch is always deployable** - Every commit on main goes to production
- **Small, incremental changes** - PRs focused and reviewable in < 30 minutes
- **Feature flags** - Hide incomplete features behind flags
- **Test before merge** - All changes must have appropriate test coverage
- **Fail fast** - Automated checks catch issues immediately

See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for the complete iteration roadmap (35+ iterations).

---

## Documentation

- [**REQUIREMENTS.md**](REQUIREMENTS.md) - Comprehensive project requirements and design decisions
- [**DEVELOPMENT-STANDARDS.md**](DEVELOPMENT-STANDARDS.md) - Web standards, accessibility, security, performance guidelines
- [**TECHNOLOGY-STACK.md**](TECHNOLOGY-STACK.md) - Technology choices with rationale and examples
- [**IMPLEMENTATION-PLAN.md**](IMPLEMENTATION-PLAN.md) - Complete iteration roadmap (35+ micro-releases)
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

### Phase 0: Foundation (Current - Week 1)

- ✅ **Iteration 0.1:** Project Scaffolding - COMPLETE!
- ⏳ **Iteration 0.2:** Testing Infrastructure (Vitest + RTL + Playwright)
- ⏳ **Iteration 0.3:** CI/CD Pipeline (GitHub Actions)
- ⏳ **Iteration 0.4:** Dependency Injection Setup (InversifyJS)
- ⏳ **Iteration 0.5:** Feature Flag System

### Phase 1: Core Infrastructure (Week 2-3)

- Layout & Navigation Shell
- Radix UI + Tailwind Integration
- State Management Setup (Zustand + Immer)
- Error Boundary & Loading States

### Phase 2: Home Assistant Connection (Week 3-4)

- Environment Configuration
- HTTP Client Service (Axios)
- WebSocket Service with reconnection
- Entity Service

### Phase 3: Floor Plan Foundation (Week 4-5)

- Floor Plan Data Model (JSON/TypeScript)
- Konva Setup & Basic Canvas
- Room Rendering
- Multi-Floor Navigation

### Phase 4: First Overlay - Lighting (Week 5-6)

- Overlay System Architecture
- Device Placement on Floor Plan
- Light Control
- Light Details Panel

### Phase 5: Polish & PWA (Week 6-7)

- PWA Configuration
- Offline Support (LKG values)
- Performance Optimization
- User Onboarding

See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for complete roadmap with 35+ iterations.

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
