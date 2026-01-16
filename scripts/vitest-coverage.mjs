import { spawn } from 'node:child_process';
import process from 'node:process';

function ensureNodeOptionsHasHeapLimit(nodeOptions, heapMb) {
  const value = typeof nodeOptions === 'string' ? nodeOptions : '';
  if (value.includes('--max-old-space-size')) return value;
  const prefix = value.trim().length > 0 ? value.trim() + ' ' : '';
  return `${prefix}--max-old-space-size=${heapMb}`;
}

// Coverage instrumentation + report generation can be memory-heavy.
// Vitest runs tests in forked Node workers; we need the heap limit to apply
// to those children too. NODE_OPTIONS is inherited by the forked workers.
const heapMbRaw = process.env.VITEST_COVERAGE_HEAP_MB;
const heapMb = Number.isFinite(Number(heapMbRaw)) ? Number(heapMbRaw) : 16384;

const includeSlow = process.argv.includes('--include-slow');

process.env.NODE_OPTIONS = ensureNodeOptionsHasHeapLimit(process.env.NODE_OPTIONS, heapMb);

// Let vitest.config.ts detect a coverage run (so it can adjust worker memory limits).
process.env.VITEST_COVERAGE_RUN = 'true';

// Mirror the productivity-first default behavior from `pnpm test`.
// This keeps coverage usable even when a single pathological test OOMs.
if (!includeSlow) {
  process.env.VITEST_SKIP_OOM_TESTS = 'true';
}

// Default to V8 coverage. Istanbul can be significantly more memory hungry in jsdom-heavy suites
// and has been observed to OOM after tests complete on Windows.
if (!process.env.VITEST_COVERAGE_PROVIDER) {
  process.env.VITEST_COVERAGE_PROVIDER = 'v8';
}

// Ensure we actually emit a browsable report.
if (
  typeof process.env.VITEST_COVERAGE_REPORTERS !== 'string' ||
  process.env.VITEST_COVERAGE_REPORTERS.trim() === ''
) {
  process.env.VITEST_COVERAGE_REPORTERS = 'text-summary,html';
}

const vitestEntry = 'node_modules/vitest/vitest.mjs';
const passthroughArgs = process.argv.slice(2);
const args = [vitestEntry, 'run', '--coverage', ...passthroughArgs];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  console.error(`vitest exited via signal ${signal}`);
  process.exit(1);
});
