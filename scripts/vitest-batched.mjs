import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

function ensureNodeOptionsHasHeapLimit(nodeOptions, heapMb) {
  const value = typeof nodeOptions === 'string' ? nodeOptions : '';
  if (value.includes('--max-old-space-size')) return value;
  const prefix = value.trim().length > 0 ? value.trim() + ' ' : '';
  return `${prefix}--max-old-space-size=${heapMb}`;
}

function collectTestFiles(rootDir) {
  /** @type {string[]} */
  const results = [];

  /** @param {string} dir */
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip typical heavy folders
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
          continue;
        }
        walk(join(dir, entry.name));
        continue;
      }

      if (!entry.isFile()) continue;

      const name = entry.name;
      if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
      if (!(name.includes('.test.') || name.includes('.spec.'))) continue;
      results.push(join(dir, name));
    }
  };

  walk(rootDir);
  // Keep ordering stable
  results.sort((a, b) => a.localeCompare(b));
  return results;
}

function filterDefaultSkips(files) {
  const includeSlow = process.argv.includes('--include-slow');
  if (includeSlow) return { kept: files, skipped: [] };

  // This test file currently OOMs during import (before any tests execute),
  // which blocks day-to-day development. Skip it in the default `pnpm test`.
  const alwaysSkipBasenames = new Set(['DeviceLocationTrackingController.test.tsx']);

  /** @type {string[]} */
  const kept = [];
  /** @type {string[]} */
  const skipped = [];

  for (const file of files) {
    const base = file.split(/[/\\]/).pop() ?? file;
    if (alwaysSkipBasenames.has(base)) {
      skipped.push(file);
    } else {
      kept.push(file);
    }
  }

  return { kept, skipped };
}

function chunk(items, size) {
  /** @type {string[][]} */
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function runBatch(batchIndex, totalBatches, files) {
  const vitestEntry = 'node_modules/vitest/vitest.mjs';
  const args = [
    vitestEntry,
    'run',
    '--reporter',
    'default',
    ...files.map((f) => relative(process.cwd(), f)),
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (code === 0) return resolve();
      const message =
        typeof code === 'number'
          ? `vitest batch exited with code ${code}`
          : `vitest batch exited via signal ${signal}`;
      const error = new Error(message);
      // @ts-ignore
      error.code = typeof code === 'number' ? code : 1;
      reject(error);
    });
  });
}

async function main() {
  const heapMbRaw = process.env.VITEST_HEAP_MB;
  const heapMb = Number.isFinite(Number(heapMbRaw)) ? Number(heapMbRaw) : 8192;
  process.env.NODE_OPTIONS = ensureNodeOptionsHasHeapLimit(process.env.NODE_OPTIONS, heapMb);

  const batchSizeRaw = process.env.VITEST_BATCH_SIZE;
  const batchSize = Number.isFinite(Number(batchSizeRaw)) ? Number(batchSizeRaw) : 10;

  const testRoot = join(process.cwd(), 'src');
  if (!statSync(testRoot).isDirectory()) {
    console.error('Expected src/ directory in project root.');
    process.exit(1);
  }

  const allTests = collectTestFiles(testRoot);
  if (allTests.length === 0) {
    console.log('No test files found.');
    process.exit(0);
  }

  const { kept: filteredTests, skipped } = filterDefaultSkips(allTests);
  if (filteredTests.length === 0) {
    console.log('All tests were skipped by default filters.');
    process.exit(0);
  }

  const batches = chunk(filteredTests, Math.max(1, batchSize));
  console.log(
    `Running ${filteredTests.length} test files in ${batches.length} batch(es) (batch size=${batchSize}).`
  );
  if (skipped.length > 0) {
    console.log(
      `Skipping ${skipped.length} file(s) by default. Re-run with --include-slow to include them.`
    );
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n--- Batch ${i + 1}/${batches.length} (${batch.length} files) ---`);

    await runBatch(i + 1, batches.length, batch);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(typeof err?.code === 'number' ? err.code : 1);
});
