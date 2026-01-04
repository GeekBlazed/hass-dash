# Contributing to Home Assistant Dashboard

<!-- markdownlint-disable MD036 MD060 -->

Thank you for your interest in contributing to **hass-dash**! This document provides guidelines and instructions for contributing to this project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Continuous Integration & Delivery](#continuous-integration--delivery)
- [Branch Protection & Pull Requests](#branch-protection--pull-requests)
- [Code Quality Standards](#code-quality-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Development Standards](#development-standards)
- [Architecture Requirements](#architecture-requirements)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

**Key Principles:**

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on the problem, not the person
- Assume good intentions
- Respect different viewpoints and experiences

---

## Getting Started

### Prerequisites

- **Node.js:** 20+ (LTS version)
- **pnpm:** 8+
- **Git:** Latest version
- **VS Code:** Recommended (with project extensions)
- **Home Assistant:** Instance for testing (can be local or remote)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/hass-dash.git
   cd hass-dash
   ```

3. **Add upstream remote:**

   ```bash
   git remote add upstream https://github.com/GeekBlazed/hass-dash.git
   ```

4. **Install dependencies:**

   ```bash
   pnpm install
   ```

5. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your Home Assistant details
   ```

6. **Verify setup:**

   ```bash
   pnpm test
   pnpm lint
   pnpm dev
   ```

---

## Development Workflow

### Branch Strategy

This project uses **trunk-based development** with feature branches:

- **`main`** - Protected branch, always deployable
- **`feature/*`** - New features (e.g., `feature/climate-overlay`)
- **`fix/*`** - Bug fixes (e.g., `fix/websocket-reconnect`)
- **`refactor/*`** - Code refactoring (e.g., `refactor/auth-service`)
- **`docs/*`** - Documentation updates (e.g., `docs/api-reference`)
- **`test/*`** - Test improvements (e.g., `test/add-e2e-coverage`)

### Creating a Feature Branch

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create a new feature branch
git checkout -b feature/my-awesome-feature

# Make your changes...

# Commit your changes (see commit guidelines below)
git add .
git commit -m "feat(overlay): add climate heat map visualization"

# Push to your fork
git push origin feature/my-awesome-feature
```

---

## Continuous Integration & Delivery

### Ship-It-Today Philosophy

This project follows a **continuous integration and continuous delivery (CI/CD)** model:

**Core Principles:**

- **Main is Always Deployable** - Every commit on main goes to production
- **Small, Incremental Changes** - PRs should be focused and reviewable in < 30 minutes
- **Feature Flags** - Hide incomplete features behind flags (see [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md))
- **Test Before Merge** - All changes must have appropriate test coverage
- **Fail Fast** - Automated checks catch issues immediately

### Micro-Releases

Each merged PR is a **micro-release**:

- Automatically deployed to production
- Tagged with semantic version
- Documented in changelog
- Monitored for errors

**Benefits:**

- Faster feedback from real users
- Easier to identify and roll back issues
- Lower risk per deployment
- Continuous value delivery

### Working with Feature Flags

For features that take multiple PRs, use **feature flags**:

```typescript
// Add flag to .env
VITE_FEATURE_CLIMATE_OVERLAY=false

// Use in code
if (featureFlags.isEnabled('CLIMATE_OVERLAY')) {
  return <ClimateOverlay />;
}
```

**Flag Guidelines:**

- Add new flags to `.env.example`
- Default to `false` until feature is complete
- Document flag purpose in code comments
- Remove flags promptly after feature launches
- Set quarterly reminders to audit stale flags

### CI Pipeline

Every PR triggers automated checks:

**✅ Required Checks:**

1. **Lint** - Code style compliance (ESLint + Prettier)
2. **Type Check** - TypeScript strict mode
3. **Unit Tests** - All tests pass, coverage ≥ 80%
4. **Build** - Production build succeeds
5. **Bundle Size** - Must be < 250KB gzipped

**📊 Optional Reports:**

- Code coverage trends
- Bundle size comparison
- Lighthouse performance scores

### CD Pipeline

On merge to `main`, automatic deployment:

1. **Build** production assets
2. **Deploy** to hosting (GitHub Pages/Netlify)
3. **Tag** with version number
4. **Notify** team in chat/email
5. **Monitor** for errors

**Rollback Strategy:**

- Revert commit and push immediately
- OR redeploy previous tag
- Post-mortem to prevent recurrence

---

## Branch Protection & Pull Requests

### Important: No Direct Pushes to Main

The `main` branch is **protected**. All changes must go through pull requests with the following requirements:

✅ **Required Checks:**

- At least **1 approval** from a maintainer
- All **CI checks passing** (tests, linting, build)
- **No merge conflicts**
- **Conversation resolution** (all review comments addressed)

✅ **Branch Protection Rules:**

- Direct pushes to `main` are **blocked**
- Force pushes are **disabled**
- Branch deletion is **disabled**
- Status checks must pass before merging
- Branch must be up-to-date with `main`

### Pull Request Workflow

1. **Create your feature branch** (see above)
2. **Make your changes** following code standards
3. **Write tests** for your changes (required)
4. **Update documentation** if needed
5. **Run all checks locally:**

   ```bash
   pnpm lint        # Check code style
   pnpm format      # Format code
   pnpm test        # Run unit/integration tests
   pnpm test:e2e    # Run E2E tests (if applicable)
   pnpm build       # Verify build succeeds
   ```

6. **Push to your fork:**

   ```bash
   git push origin feature/my-awesome-feature
   ```

7. **Open a Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Fill out the PR template completely
   - Reference any related issues (e.g., "Fixes #123")
   - Add screenshots/videos for UI changes
   - Request review from maintainers

8. **Address review feedback:**
   - Make requested changes
   - Push additional commits to your branch
   - Respond to comments
   - Mark conversations as resolved

9. **Merge:**
   - Once approved and all checks pass, a maintainer will merge your PR
   - Your branch will be deleted automatically

---

## Code Quality Standards

### TypeScript Strict Mode

All code must pass TypeScript strict mode checks:

```typescript
// ✅ GOOD: Explicit types
function calculateTemperature(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

// ❌ BAD: Implicit any
function calculateTemperature(celsius) {
  return (celsius * 9) / 5 + 32;
}
```

### ESLint Rules

The project enforces strict ESLint rules:

- No `any` types (use `unknown` with type guards)
- No unused variables
- Explicit function return types
- React hooks rules
- Accessibility (jsx-a11y) rules

### Code Formatting

We use **Prettier** for consistent formatting:

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

**Husky pre-commit hooks** automatically lint and format staged files.

### File Naming Conventions

- **Components:** `PascalCase` (e.g., `FloorPlan.tsx`)
- **Services/Utilities:** `kebab-case` (e.g., `weather-service.ts`)
- **Tests:** `*.test.ts` or `*.spec.ts`
- **Interfaces:** Prefix with `I` (e.g., `IWeatherService.ts`)

---

## Testing Requirements

### Mandatory Tests

**All features MUST have tests.** Pull requests without adequate test coverage will not be accepted.

#### Minimum Coverage: 80%

```bash
# Run tests with coverage
pnpm test:coverage

# View coverage report
open coverage/index.html
```

#### Test Types Required

1. **Unit Tests** - Test individual functions/classes in isolation

   ```typescript
   // services/__tests__/weather-service.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { WeatherService } from '../weather-service';

   describe('WeatherService', () => {
     it('should fetch current weather', async () => {
       const mockClient = { getState: vi.fn().mockResolvedValue({ temp: 72 }) };
       const service = new WeatherService(mockClient);

       const weather = await service.getCurrentWeather();

       expect(weather.temperature).toBe(72);
     });
   });
   ```

2. **Integration Tests** - Test service interactions

   ```typescript
   describe('WeatherOverlay Integration', () => {
     it('should display weather data from service', async () => {
       // Test component with real service (mocked backend)
     });
   });
   ```

3. **Component Tests** - Test UI components

   ```typescript
   import { render, screen } from '@testing-library/react';
   import { FloorPlan } from '../FloorPlan';

   describe('FloorPlan', () => {
     it('should render rooms', () => {
       render(<FloorPlan rooms={mockRooms} />);
       expect(screen.getByText('Living Room')).toBeInTheDocument();
     });
   });
   ```

4. **E2E Tests** - Test critical user flows (Playwright)

   ```typescript
   import { test, expect } from '@playwright/test';

   test('user can toggle climate overlay', async ({ page }) => {
     await page.goto('/');
     await page.click('[data-testid="climate-toggle"]');
     await expect(page.locator('.climate-overlay')).toBeVisible();
   });
   ```

### Test-Driven Development (TDD)

While not required, TDD is **strongly encouraged**:

1. Write failing test
2. Write minimum code to pass
3. Refactor while keeping tests green

---

## Commit Message Guidelines

We follow the **Conventional Commits** specification:

### Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, no logic change)
- **refactor:** Code refactoring
- **test:** Adding or updating tests
- **chore:** Maintenance tasks, dependency updates
- **perf:** Performance improvements
- **ci:** CI/CD changes

### Examples

```bash
# Feature with scope
feat(climate): add temperature heat map overlay

Implements visual heat map showing temperature gradients across
rooms. Uses Konva.js for rendering with smooth color transitions.

Closes #42

# Bug fix
fix(auth): prevent token refresh loop

The token was being refreshed on every request causing
authentication failures. Added 5-minute buffer before expiry.

Fixes #67

# Breaking change
feat(api)!: update Home Assistant API client to v2

BREAKING CHANGE: IHomeAssistantClient interface now uses promises
instead of callbacks. All services using this interface must be updated.

# Simple documentation update
docs: update installation instructions for pnpm
```

### Commit Message Rules

- Use imperative mood ("add" not "added" or "adds")
- First line max 72 characters
- Reference issues and PRs when applicable
- Explain **why** not **what** in the body
- Mark breaking changes with `!` or `BREAKING CHANGE:`

---

## Pull Request Process

### Before Opening a PR

- [ ] Code follows project standards
- [ ] All tests pass (`pnpm test`)
- [ ] Coverage meets 80% minimum
- [ ] Linting passes (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation is updated
- [ ] Commit messages follow convention

### PR Template

When opening a PR, fill out all sections:

```markdown
## Description

[Clear description of what this PR does]

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues

Fixes #[issue number]
Relates to #[issue number]

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Screenshots (for UI changes)

[Add screenshots or videos]

## Checklist

- [ ] Code follows SOLID principles
- [ ] All services use interfaces
- [ ] Tests have 80%+ coverage
- [ ] Documentation updated
- [ ] No breaking changes (or documented if unavoidable)
- [ ] Accessibility checked (WCAG 2.2 AA)

## Additional Notes

[Any other information]
```

### Review Process

1. **Automated Checks** - CI runs tests, linting, build
2. **Maintainer Review** - At least one approval required
3. **Address Feedback** - Make requested changes
4. **Final Approval** - Once all checks pass and feedback addressed
5. **Merge** - Maintainer merges using "Squash and Merge"

### After Your PR is Merged

1. **Update your fork:**

   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

2. **Delete your feature branch:**

   ```bash
   git branch -d feature/my-awesome-feature
   git push origin --delete feature/my-awesome-feature
   ```

---

## Development Standards

### Web Standards Compliance

All code must comply with modern web standards. See [DEVELOPMENT-STANDARDS.md](DEVELOPMENT-STANDARDS.md) for details:

- **HTML5** semantic markup
- **CSS3** modern features (Grid, Flexbox, Custom Properties)
- **ES6+** JavaScript features
- **WCAG 2.2** Level AA accessibility minimum
- **PWA** best practices
- **HTTPS/TLS** for production
- **CSP** (Content Security Policy)
- **Core Web Vitals** performance targets

---

## Architecture Requirements

### SOLID Principles (STRICTLY ENFORCED)

This is **non-negotiable**. All contributions must follow SOLID principles.

#### 1. Single Responsibility Principle (SRP)

```typescript
// ✅ GOOD: Each class has one responsibility
class WeatherDataFetcher {
  fetchWeather(): Promise<WeatherData> {
    /* ... */
  }
}

class WeatherDataFormatter {
  format(data: WeatherData): string {
    /* ... */
  }
}

// ❌ BAD: Class does too many things
class WeatherManager {
  fetchWeather() {
    /* ... */
  }
  formatWeather() {
    /* ... */
  }
  displayWeather() {
    /* ... */
  }
  logWeather() {
    /* ... */
  }
}
```

#### 2. Open/Closed Principle (OCP)

```typescript
// ✅ GOOD: Open for extension, closed for modification
interface IOverlay {
  render(): void;
}

class ClimateOverlay implements IOverlay {
  render() {
    /* climate rendering */
  }
}

class SecurityOverlay implements IOverlay {
  render() {
    /* security rendering */
  }
}

// ❌ BAD: Must modify existing code to add features
class OverlayManager {
  render(type: string) {
    if (type === 'climate') {
      /* ... */
    } else if (type === 'security') {
      /* ... */
    }
    // Must modify this to add new overlay types
  }
}
```

#### 3. Liskov Substitution Principle (LSP)

```typescript
// ✅ GOOD: Derived classes can replace base class
interface IDataService {
  getData(): Promise<Data>;
}

class HomeAssistantService implements IDataService {
  async getData(): Promise<Data> {
    /* ... */
  }
}

class MockDataService implements IDataService {
  async getData(): Promise<Data> {
    /* ... */
  }
}

// Both can be used interchangeably
```

#### 4. Interface Segregation Principle (ISP)

```typescript
// ✅ GOOD: Specific interfaces
interface IReadService {
  read(id: string): Promise<Data>;
}

interface IWriteService {
  write(data: Data): Promise<void>;
}

// ❌ BAD: Fat interface
interface IDataService {
  read(id: string): Promise<Data>;
  write(data: Data): Promise<void>;
  delete(id: string): Promise<void>;
  update(id: string, data: Data): Promise<void>;
  // Read-only services forced to implement write methods
}
```

#### 5. Dependency Inversion Principle (DIP)

**CRITICAL:** All services MUST sit behind interfaces.

```typescript
// ✅ GOOD: Depends on abstraction
interface IWeatherService {
  getCurrentWeather(): Promise<WeatherData>;
}

@injectable()
class WeatherOverlay {
  constructor(@inject('IWeatherService') private weatherService: IWeatherService) {}
}

// Can swap implementations without changing WeatherOverlay
class HomeAssistantWeatherService implements IWeatherService {
  /* ... */
}
class OpenWeatherMapService implements IWeatherService {
  /* ... */
}
class MockWeatherService implements IWeatherService {
  /* ... */
}
```

```typescript
// ❌ BAD: Depends on concrete class
class WeatherOverlay {
  constructor(private weatherService: HomeAssistantWeatherService) {}
  // Cannot easily swap implementations or test
}
```

### Dependency Injection

Use **InversifyJS** for all service dependencies:

```typescript
// di-container.ts
import { Container } from 'inversify';

const container = new Container();

container
  .bind<IWeatherService>('IWeatherService')
  .to(HomeAssistantWeatherService)
  .inSingletonScope();

export { container };
```

```typescript
// Using the service
import { container } from './di-container';

const weatherService = container.get<IWeatherService>('IWeatherService');
```

---

## UI/UX Guidelines

### Accessibility (WCAG 2.2 AA)

- All interactive elements must be keyboard accessible
- Color contrast: 4.5:1 minimum for text
- Alt text for all meaningful images
- ARIA labels for dynamic content
- Focus indicators visible
- Screen reader tested

### Responsive Design

Test on all target sizes:

- Mobile: 375px minimum width
- Tablet: 768px minimum width
- Desktop: 1920px recommended

### Performance

- Bundle size: Monitor with `pnpm build`
- Lazy load routes and heavy components
- Optimize images (WebP with fallbacks)
- Use React.memo for expensive components
- Debounce/throttle frequent updates

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** - Your issue may already exist
2. **Check documentation** - The answer might be there
3. **Try latest version** - Bug might be fixed
4. **Minimal reproduction** - Can you reproduce it consistently?

### Bug Report Template

```markdown
**Bug Description**
Clear and concise description of the bug

**Steps to Reproduce**

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Screenshots**
If applicable, add screenshots

**Environment**

- Browser: [e.g., Chrome 120]
- OS: [e.g., Windows 11]
- Node version: [e.g., 20.10.0]
- Home Assistant version: [e.g., 2025.1]
- App version: [e.g., 0.1.0]

**Additional Context**
Any other relevant information
```

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Problem Statement**
What problem does this solve? Why is it needed?

**Proposed Solution**
How should this work?

**Alternative Solutions**
Other approaches considered

**Additional Context**
Mockups, examples, references
```

---

## Getting Help

### Resources

- **Documentation:** [Project Docs](README.md)
- **Issues:** [GitHub Issues](https://github.com/GeekBlazed/hass-dash/issues)
- **Discussions:** [GitHub Discussions](https://github.com/GeekBlazed/hass-dash/discussions)

### Questions?

- **General questions:** Use [GitHub Discussions](https://github.com/GeekBlazed/hass-dash/discussions)
- **Bug reports:** Open an [issue](https://github.com/GeekBlazed/hass-dash/issues)
- **Feature requests:** Open an [issue](https://github.com/GeekBlazed/hass-dash/issues) with "enhancement" label

### Community Guidelines

- Be patient and respectful
- Search before asking
- Provide context and details
- Share knowledge and help others
- Follow the Code of Conduct

---

## Learning Resources

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### React

- [React Docs](https://react.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### Testing

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)

### SOLID Principles

- [SOLID Principles in TypeScript](https://khalilstemmler.com/articles/solid-principles/solid-typescript/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

## Recognition

All contributors are recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for their contributions
- **Project documentation** where applicable

We value all types of contributions:

- 💻 Code (features, fixes, refactoring)
- 📝 Documentation improvements
- 🐛 Bug reports and testing
- 🎨 Design and UX suggestions
- 🌍 Translation and localization
- 💬 Community support and mentoring

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You

Thank you for contributing to **hass-dash**! Your efforts help make home automation more accessible and intuitive for everyone.

**Questions?** Don't hesitate to ask in [Discussions](https://github.com/GeekBlazed/hass-dash/discussions)!

---

**Happy Coding! 🚀**
