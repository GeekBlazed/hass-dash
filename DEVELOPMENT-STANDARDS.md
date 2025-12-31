# Modern Web Standards Cheat Sheet (2025 Edition)
<!-- markdownlint-disable MD036 MD060 -->

A quick-reference guide for web developers building modern, interoperable, standards-compliant web applications.

---

## 1. Core Web Building Blocks (W3C / WHATWG)

### HTML (Structure)

Foundation of all web content; universally supported.

- Use semantic elements (`<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`) for accessible, machine-readable layouts
- Standardized and maintained by W3C and WHATWG

**Useful HTML5 Features:**

- `<video>`, `<audio>` media APIs
- Native form validation
- `<canvas>` + SVG graphics
- Custom data attributes (`data-*`)

### CSS (Presentation)

Controls layout, colors, animations, responsiveness.

- Most-used web standard (95.8% adoption in 2025)

**Modern CSS Essentials:**

- Flexbox
- CSS Grid
- Custom properties (`--variables`)
- Media queries + container queries
- CSS animations/transitions

### JavaScript + ECMAScript (Behavior)

Powers interactivity and application logic.

- ECMAScript defines the language; W3C defines browser APIs

**Key Features:**

- ES6+ syntax (modules, classes, arrow functions)
- Promises, async/await
- Fetch API
- Web Workers for parallel tasks
- DOM API for dynamic UI

---

## 2. Essential Web APIs (W3C Web Platform)

### Networking & Storage

- **Fetch API** – Modern HTTP requests
- **LocalStorage / SessionStorage** – Simple key/value storage
- **IndexedDB** – Structured client-side database

### App Capabilities

- **Service Workers** – Offline, caching, PWA foundation
- **Web App Manifest** – Installable web apps
- **Notification API** – Push notifications
- **Geolocation API** – Location services
- **IntersectionObserver** – Efficient scroll/visibility tracking

### Real-Time & Media

- **WebRTC** – Audio/video peer connections
- **MediaDevices API** – Access cameras/mics
- **WebSocket** – Bidirectional real-time communication

---

## 3. Continuous Integration & Delivery (CI/CD)

### Philosophy

This project follows a **"ship-it-today"** continuous delivery model where every merge to `main` is automatically deployed to production.

### CI/CD Principles

**✅ Always Deployable:**

- Main branch is production-ready at all times
- No "integration hell" - merge frequently
- Feature flags hide incomplete work

**✅ Automated Testing:**

- Unit tests run on every commit
- Integration tests run on every PR
- E2E tests run before deployment
- Coverage must be ≥ 80%

**✅ Automated Deployment:**

- Merge to main triggers build
- Build artifacts deployed automatically
- Rollback available via git revert

**✅ Small Batch Sizes:**

- PRs should be < 400 lines changed
- Focused on single feature/fix
- Reviewable in < 30 minutes

### CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request, push]

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
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test:coverage
      - run: pnpm build
      - name: Check bundle size
        run: pnpm bundlesize
```

### CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Feature Flags

**Purpose:** Enable continuous integration of incomplete features.

```typescript
// Define in .env
VITE_FEATURE_CLIMATE_OVERLAY=false

// Service implementation
class FeatureFlagService implements IFeatureFlagService {
  isEnabled(flag: string): boolean {
    const envVar = `VITE_FEATURE_${flag.toUpperCase()}`;
    return import.meta.env[envVar] === 'true';
  }
}

// Usage in components
function Dashboard() {
  const flags = useFeatureFlags();
  
  return (
    <>
      <FloorPlan />
      {flags.isEnabled('CLIMATE_OVERLAY') && <ClimateOverlay />}
    </>
  );
}
```

**Flag Best Practices:**

- Default flags to `false` until feature complete
- Remove flags 2-4 weeks after launch
- Set quarterly reminders to audit stale flags
- Document flag purpose in code comments

### Release Strategy

**Micro-Releases:**

- Every PR merge = new version deployed
- Semantic versioning: `v0.1.0`, `v0.1.1`, etc.
- Automated changelog generation

**Monthly Milestones:**

- Group features into themed releases
- Marketing announcements
- Blog posts and demos
- Community engagement

### Monitoring & Rollback

**Post-Deployment Monitoring:**

- Error tracking (Sentry, LogRocket)
- Performance monitoring (Web Vitals)
- User feedback channels

**Rollback Procedure:**

```bash
# Identify bad commit
git log --oneline

# Revert and push
git revert <commit-hash>
git push origin main

# CI/CD automatically deploys reverted version
```

**Post-Mortem:**

- Document what went wrong
- Identify prevention measures
- Update tests to catch similar issues
- Share learnings with team

---

## 4. Accessibility Standards

**Accessibility is not optional — it is required by law in many regions.**

### WCAG 2.2 (Web Content Accessibility Guidelines)

- Global standard for accessible content
- Defines success criteria at Levels A, AA, AAA
- **Target:** Minimum AA compliance for all features

### ARIA (Accessible Rich Internet Applications)

- Adds roles, states, and properties for screen readers
- Use semantic HTML first, ARIA when needed
- Follow the "First Rule of ARIA": Don't use ARIA if you can use native HTML

### Legal Accessibility Frameworks

- **ADA (U.S.)** – Businesses must meet accessibility requirements
- **Section 508** – Federal agency requirements
- **EN 301 549** – European accessibility standard
- **AODA** – Accessibility for Ontarians with Disabilities Act

### Implementation Requirements for This Project

- All interactive elements must be keyboard accessible
- Color contrast ratios must meet WCAG AA standards (4.5:1 for normal text)
- All images must have appropriate alt text
- Forms must have proper labels and error messages
- Focus indicators must be visible
- Screen reader testing required for major features

---

## 5. Security & Privacy Standards

### HTTPS / TLS

- **Mandatory** for most APIs (e.g., geolocation, service workers)
- All production deployments must use HTTPS
- Certificate management and renewal procedures required

### CSP (Content Security Policy)

- Mitigates XSS and injection vulnerabilities
- Define strict content sources
- Use nonces or hashes for inline scripts when necessary

**Example CSP Header:**

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;
```

### CORS (Cross-Origin Resource Sharing)

- Controls cross-domain permissions
- Configure properly for Home Assistant API access
- Validate origins in backend configurations

### GDPR & Privacy

- Controls how personal data is collected and processed
- Obtain consent for data collection
- Provide data export and deletion capabilities
- Maintain privacy policy and terms of service

### Security Best Practices for This Project

- Never store credentials in localStorage (use secure, httpOnly cookies when possible)
- Sanitize all user inputs
- Implement rate limiting for API calls
- Use Content Security Policy headers
- Regular security audits and dependency updates
- Implement proper authentication token handling
- Follow OWASP Top 10 guidelines

---

## 6. Performance Standards

### Core Web Vitals

Measures real-world UX:

- **LCP (Largest Contentful Paint)** – Target: < 2.5s
- **FID / INP (Input Responsiveness)** – Target: < 100ms / < 200ms
- **CLS (Cumulative Layout Shift)** – Target: < 0.1

### Performance Targets for This Project

- **Initial Load:** < 3 seconds on 3G
- **Time to Interactive:** < 5 seconds
- **Bundle Size:** < 250KB gzipped (initial bundle)
- **Code Splitting:** Route-based and component-based lazy loading
- **Image Optimization:** WebP with fallbacks, responsive images
- **Caching Strategy:** Aggressive caching via service workers

### HTTP/2 & HTTP/3

- Modern protocols improving loading speed, multiplexing, and security
- Ensure server configurations support HTTP/2 minimum
- HTTP/3 (QUIC) preferred when available

### Optimization Techniques

- Tree-shaking and dead code elimination
- Minification and compression (gzip/brotli)
- Critical CSS inlining
- Lazy loading of images and components
- CDN usage for static assets
- Resource hints (preload, prefetch, preconnect)

---

## 7. Progressive Web App (PWA) Standards

### Service Workers

- Offline caching and background sync
- Cache-first, network-first, or stale-while-revalidate strategies
- Version management for cache updates

**Service Worker Registration:**

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered:', reg))
    .catch(err => console.log('SW registration failed:', err));
}
```

### Web App Manifest

Controls installation and "app-like" behavior.

**Required Manifest Properties:**

```json
{
  "name": "Home Assistant Dashboard",
  "short_name": "HassDash",
  "description": "Visual companion app for Home Assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3f51b5",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Push API

- Real-time notifications supported in modern browsers
- **Note:** This project does NOT implement push notifications (handled by Home Assistant)
- Include push API support for potential future integration

### PWA Requirements for This Project

- Installable on desktop and mobile
- Works offline with cached data
- Fast and reliable performance
- Engaging user experience matching native apps
- Responsive on all device sizes

---

## 8. IEEE Standards Relevant to Modern Web Applications

IEEE doesn't define browser standards, but it defines protocols that the web depends on.

### IEEE 802.11 (Wi-Fi)

- The wireless foundation supporting virtually all web access
- Understanding Wi-Fi standards helps optimize for network conditions
- Consider network quality indicators in the app

### IEEE 2874–2025 Spatial Web Standard

A new global standard defining:

- Semantic, spatial, and temporal context
- Identity via W3C DID-core
- Interoperability between AI agents, IoT, robots, and digital environments

**Relevance:** Increasingly important as web apps expand into AR/VR, robotics, and spatial computing. While not immediately applicable, this standard may influence future spatial visualization features.

---

## 9. Developer Quick Commands & Snippets

### HTML5 Boilerplate

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Home Assistant Dashboard" />
  <meta name="theme-color" content="#3f51b5" />
  <title>Home Assistant Dashboard</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### CSS Reset Example

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  line-height: 1.5;
}
```

### Service Worker Registration

```javascript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}
```

### Fetch API with Error Handling

```javascript
async function fetchData(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
```

### IndexedDB Basic Setup

```javascript
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HassDashDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('entities')) {
        const entityStore = db.createObjectStore('entities', { keyPath: 'id' });
        entityStore.createIndex('type', 'type', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('layouts')) {
        db.createObjectStore('layouts', { keyPath: 'id' });
      }
    };
  });
}
```

### WebSocket Connection with Reconnect

```javascript
class WebSocketManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectDelay = 1000;
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(() => {
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
        this.connect();
      }, this.reconnectDelay);
    };
  }
  
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  handleMessage(data) {
    // Override this method
  }
}
```

---

## 10. Summary Table (At a Glance)

| Category | Key Standards |
|----------|---------------|
| **Structure** | HTML5, SVG |
| **Styling** | CSS3, Flexbox, Grid |
| **Behavior** | JavaScript, ECMAScript, DOM APIs |
| **Web APIs** | Fetch, Storage, WebRTC, Service Workers |
| **Accessibility** | WCAG 2.2, ARIA |
| **Security** | HTTPS, CSP, CORS |
| **Performance** | Core Web Vitals, HTTP/2, HTTP/3 |
| **PWA** | Web App Manifest, Service Worker |
| **IEEE Infra** | 802.11 Wi-Fi |
| **Emerging IEEE** | IEEE 2874 Spatial Web |

---

## 11. Testing Standards

### Browser Compatibility Testing

**Required Browsers:**

- Chrome/Edge 100+ (Desktop & Mobile)
- Firefox 100+ (Desktop & Mobile)
- Safari 15+ (Desktop & Mobile)

**Testing Tools:**

- BrowserStack or similar cross-browser testing platform
- Lighthouse for performance and PWA audits
- axe DevTools for accessibility testing
- Chrome DevTools for debugging and profiling

### Performance Testing

- Lighthouse CI in the build pipeline
- Core Web Vitals monitoring in production
- Bundle size monitoring with size-limit
- Network throttling tests (3G, 4G, Offline)

### Accessibility Testing

- Automated testing with axe-core
- Manual screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard navigation testing
- Color contrast verification

---

## 12. Additional Resources

### Official Documentation

- [W3C Standards](https://www.w3.org/standards/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Web.dev](https://web.dev/)
- [Can I Use](https://caniuse.com/)

### Accessibility

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)

### Performance

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)

### Security

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Security Headers](https://securityheaders.com/)

---

## Document Version

**Version:** 1.0  
**Last Updated:** December 31, 2025  
**Applies To:** Home Assistant Dashboard (hass-dash) project

This document should be reviewed and updated as web standards evolve.
