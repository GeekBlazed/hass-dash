# Home Assistant Dashboard (hass-dash)
<!-- markdownlint-disable MD036 MD060 -->

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A sleek, modern Progressive Web Application (PWA) that serves as an intuitive visual companion to Home Assistant. Designed for non-technical residents and visitors to interact with their smart home through a beautiful 2D spatial interface.

![Project Status](https://img.shields.io/badge/status-planning-orange.svg)
![Version](https://img.shields.io/badge/version-0.1.0--alpha-orange.svg)

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

- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite 5+
- **State Management:** Zustand + Immer
- **Dependency Injection:** InversifyJS (SOLID principles enforced)
- **2D Visualization:** Konva.js / React-Konva
- **UI Components:** Radix UI + Tailwind CSS
- **Testing:** Vitest + React Testing Library + Playwright
- **PWA:** Vite PWA Plugin with Workbox
- **Package Manager:** pnpm

See [TECHNOLOGY-STACK.md](TECHNOLOGY-STACK.md) for detailed rationale and configuration.

---

## Project Status

**Current Phase:** Requirements & Planning

- [x] Requirements documentation
- [x] Technology stack selection
- [x] Development standards defined
- [ ] Project scaffolding
- [ ] Core infrastructure
- [ ] Floor plan system
- [ ] Basic overlays
- [ ] Advanced features
- [ ] PWA optimization
- [ ] Beta release

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS)
- pnpm 8+
- Git
- Home Assistant instance (for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/GeekBlazed/hass-dash.git
cd hass-dash

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your Home Assistant details
# VITE_HA_BASE_URL=http://homeassistant.local:8123
# VITE_HA_WEBSOCKET_URL=ws://homeassistant.local:8123/api/websocket

# Start development server
pnpm dev
```

### Development

```bash
# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build

# Preview production build
pnpm preview
```

---

## Documentation

- [**REQUIREMENTS.md**](REQUIREMENTS.md) - Comprehensive project requirements and design decisions
- [**DEVELOPMENT-STANDARDS.md**](DEVELOPMENT-STANDARDS.md) - Web standards, accessibility, security, performance guidelines
- [**TECHNOLOGY-STACK.md**](TECHNOLOGY-STACK.md) - Technology choices with rationale and examples
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
  constructor(
    @inject('IWeatherService') private weatherService: IWeatherService
  ) {}
}
```

### Testing Requirements

- **Unit Tests:** All functions, classes, modules
- **Integration Tests:** Service interactions
- **Component Tests:** UI components with mocked dependencies
- **E2E Tests:** Critical user flows

**No PR will be merged without appropriate tests and 80% coverage.**

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
- **Core Web Vitals:** Green for LCP, FID/INP, CLS

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

The MIT License provides maximum flexibility for community contributions and adoption while being compatible with Home Assistant's Apache 2.0 license.

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

## Roadmap

### Phase 1: Foundation (Current)

- [x] Requirements & documentation
- [x] Technology selection
- [ ] Project scaffolding
- [ ] CI/CD pipeline setup

### Phase 2: Core Features

- [ ] Home Assistant API integration
- [ ] Authentication & WebSocket connection
- [ ] Floor plan rendering system
- [ ] Basic overlay implementation

### Phase 3: Enhanced Features

- [ ] Advanced overlay system
- [ ] Heat map visualization
- [ ] Camera integration
- [ ] Energy dashboard

### Phase 4: Polish & Release

- [ ] Theme system
- [ ] PWA optimization
- [ ] User testing
- [ ] Beta release

### Phase 5: Advanced Features (Future)

- [ ] Owner mode layout editing
- [ ] 3D visualization option
- [ ] AR overlay capabilities
- [ ] Multi-home support

---

## Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ for the Home Assistant community**
