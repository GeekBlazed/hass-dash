/** @type {import('@lhci/cli').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      // Build is executed by CI (pnpm build). Locally, run `pnpm build` first.
      staticDistDir: './dist',
      url: [
        'http://localhost/?lhci=1&lhciSeedLights=1&lhciOpenLightDetails=1&lhciLightEntityId=light.lhci_demo',
      ],
      numberOfRuns: 3,
      // `--no-sandbox` is required on many CI Linux runners.
      chromeFlags: [
        '--no-sandbox',
        // Reduce flakiness from background throttling (common in CI/headless).
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
      settings: {
        // Use Desktop emulation so report screenshots reflect tablet/desktop layouts.
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: 'simulate',
        // If initial render is slow under load, avoid failing with NO_FCP.
        maxWaitForFcp: 60000,
        maxWaitForLoad: 90000,
      },
    },
    assert: {
      // Keep these aligned with the Iteration 5.3 goal ("Lighthouse score 90+").
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],

        // Useful signal, but avoid blocking the pipeline while still iterating.
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals (lab proxies). These are warnings until we have a stable baseline.
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        // INP is not consistently available in navigation-mode Lighthouse runs.
        // Use TBT as a lab proxy for responsiveness in CI.
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      // Store reports locally so CI can upload them as an artifact.
      target: 'filesystem',
      outputDir: './lighthouseci',
    },
  },
};
