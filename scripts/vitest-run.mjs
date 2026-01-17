import { spawn } from 'node:child_process';
import process from 'node:process';

function ensureNodeOptionsHasHeapLimit(nodeOptions, heapMb) {
  const value = typeof nodeOptions === 'string' ? nodeOptions : '';
  if (value.includes('--max-old-space-size')) return value;
  const prefix = value.trim().length > 0 ? value.trim() + ' ' : '';
  return `${prefix}--max-old-space-size=${heapMb}`;
}

// Vitest can use a lot of memory in jsdom-heavy suites, especially on Windows.
// NODE_OPTIONS is inherited by any worker threads/processes it spawns.
const heapMbRaw = process.env.VITEST_HEAP_MB;
const heapMb = Number.isFinite(Number(heapMbRaw)) ? Number(heapMbRaw) : 8192;
process.env.NODE_OPTIONS = ensureNodeOptionsHasHeapLimit(process.env.NODE_OPTIONS, heapMb);

const vitestEntry = 'node_modules/vitest/vitest.mjs';
const args = [vitestEntry, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  console.error(`vitest exited via signal ${signal}`);
  process.exit(1);
});
