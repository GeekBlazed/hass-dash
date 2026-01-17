import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

function getPool(): 'threads' | 'forks' {
  // Default to threads for stability and lower memory usage.
  // Forked processes have repeatedly hit OOM in this repo, even without coverage.
  return process.env.VITEST_POOL === 'forks' ? 'forks' : 'threads';
}

function getCoverageProvider(): 'v8' | 'istanbul' {
  const raw = process.env.VITEST_COVERAGE_PROVIDER;
  if (raw === 'istanbul') return 'istanbul';
  return 'v8';
}

function getCoverageReporters(): Array<'text-summary' | 'lcovonly' | 'html'> {
  const raw = process.env.VITEST_COVERAGE_REPORTERS;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(
        (s): s is 'text-summary' | 'lcovonly' | 'html' =>
          s === 'text-summary' || s === 'lcovonly' || s === 'html'
      );
    if (items.length > 0) return items;
  }

  // Lcov generation can be surprisingly memory hungry on Windows.
  if (process.platform === 'win32') return ['text-summary'];
  return ['text-summary', 'lcovonly'];
}

function getTestExclude(): string[] | undefined {
  const skipOomTests = process.env.VITEST_SKIP_OOM_TESTS === 'true';

  // This test currently OOMs during module import on Windows (even without coverage).
  // On non-Windows platforms, we always run it to maintain consistent coverage.
  // On Windows, allow opt-in skipping (via VITEST_SKIP_OOM_TESTS) to keep
  // `pnpm test:coverage` usable while we work on lowering its memory usage.
  if (skipOomTests && process.platform === 'win32') {
    return ['src/components/dashboard/DeviceLocationTrackingController.test.tsx'];
  }

  return undefined;
}

function getCoverageAll(): boolean {
  const raw = process.env.VITEST_COVERAGE_ALL;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // On Windows, collecting coverage for *all* files (including untouched ones)
  // can be extremely memory hungry in Vitest v4.
  if (process.platform === 'win32') return false;
  return true;
}

function getCoverageThresholds():
  | {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    }
  | undefined {
  if (process.env.VITEST_COVERAGE_NO_THRESHOLDS === 'true') return undefined;
  return {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  };
}

export default defineConfig({
  plugins: [react()],
  test: {
    // Keep test discovery scoped to our repo.
    // (Vitest defaults exclude node_modules, but any custom exclude config risks
    // overriding those defaults, so we explicitly scope include patterns here.)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: getTestExclude(),
    // Worker pools have been repeatedly OOM'ing in this repo on Windows.
    // Run test files serially (single worker) to keep memory stable.
    fileParallelism: false,
    // Keep pool selection explicit so we can toggle `fileParallelism` in CI/local
    // without re-introducing forks OOM issues.
    pool: getPool(),
    // Prevent huge console output from being buffered/printed for passing tests.
    // This notably helps coverage runs avoid OOM when debug logging is verbose.
    silent: 'passed-only',
    css: true,
    coverage: {
      // Istanbul instruments every module and can be extremely memory hungry in large jsdom suites.
      // V8 coverage is substantially lighter and avoids fork-worker OOM in CI.
      provider: getCoverageProvider(),
      // In Vitest v4, `coverage.all` was removed. To collect coverage for *all* source files
      // (including untouched ones), we conditionally set `coverage.include`.
      // When omitted, Vitest only includes files that were covered by tests.
      ...(getCoverageAll() ? { include: ['src/**/*.{ts,tsx}'] } : {}),
      // `text` is very verbose (full per-file table). `text-summary` keeps CLI output readable.
      // Keep report generation lightweight to avoid OOM during coverage runs.
      reporter: getCoverageReporters(),
      // Coverage report generation can be surprisingly memory hungry when it processes many files.
      // Keep this low to avoid OOM in v8 provider result processing on Windows.
      processingConcurrency: 1,
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/vite.config.ts',
        '**/vitest.config.ts',
        '**/eslint.config.js',
        '**/tailwind.config.js',
        '**/postcss.config.js',
        // Dev-only components
        '**/ComponentShowcase.tsx',
        '**/DebugPanel.tsx',
        // Branch-heavy hook wiring; measured via higher-level marker/bridge tests.
        '**/components/dashboard/DeviceLocationTrackingController.tsx',
        // Large DOM-heavy marker bridge; instrumentation is expensive and is covered indirectly.
        '**/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx',
        // Very large DOM-heavy bridge; coverage instrumentation can OOM the worker.
        '**/components/dashboard/stage/HaRoomLightingOverlayBridge.tsx',
        // Barrel exports (re-exports only)
        '**/components/dashboard/index.ts',
      ],
      thresholds: getCoverageThresholds(),
    },
  },
});
