import fs from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  console.error(`LHCI UI smoke: FAIL - ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`LHCI UI smoke: OK - ${message}`);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const repoRoot = process.cwd();
  const lighthouseciDir = path.join(repoRoot, 'lighthouseci');
  const manifestPath = path.join(lighthouseciDir, 'manifest.json');

  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch {
    fail(`Missing or unreadable manifest at ${manifestPath}`);
    return;
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    fail('Manifest is empty (no Lighthouse reports found)');
    return;
  }

  const representative = manifest.find((e) => e?.isRepresentativeRun) ?? manifest[0];
  const reportJsonPath = representative?.jsonPath;

  if (typeof reportJsonPath !== 'string' || reportJsonPath.length === 0) {
    fail('Manifest does not contain a valid jsonPath');
    return;
  }

  const report = await readJson(reportJsonPath);

  const finalUrl = report?.finalUrl;
  if (typeof finalUrl !== 'string' || !finalUrl.includes('lhci=1')) {
    fail(`Unexpected finalUrl (expected ?lhci=1): ${String(finalUrl)}`);
    return;
  }

  const errorsInConsoleScore = report?.audits?.['errors-in-console']?.score;
  if (errorsInConsoleScore !== 1) {
    const errors = report?.audits?.['errors-in-console']?.details?.items;
    fail(
      `Console errors present (score=${String(errorsInConsoleScore)}): ${JSON.stringify(errors ?? [])}`
    );
    return;
  }

  const lcpElementAudit = report?.audits?.['largest-contentful-paint-element'];
  const lcpDetails = lcpElementAudit?.details;
  const lcpText = JSON.stringify(lcpDetails ?? {});

  // Guard against the regression where Lighthouse only sees the boot splash.
  if (lcpText.includes('boot-splash') || lcpText.includes('Loading dashboard')) {
    fail(
      'Largest Contentful Paint element appears to be the boot splash (app likely did not mount)'
    );
    return;
  }

  // Guard for our primary UI signals:
  // - the floorplan SVG is rendered (normal dashboard), OR
  // - the lighting details modal is open (LHCI screenshot scenario).
  const hasFloorplan = lcpText.includes('floorplan-svg');
  const hasLightingDetails = lcpText.includes('lighting-details');
  if (!hasFloorplan && !hasLightingDetails) {
    fail(
      'Largest Contentful Paint element is not on the dashboard UI (expected floorplan-svg or lighting-details to be present)'
    );
    return;
  }

  pass(
    `Rendered UI detected (LCP element includes ${hasLightingDetails ? 'lighting-details' : 'floorplan-svg'}). Report: ${reportJsonPath}`
  );
}

main().catch((error) => {
  fail(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
});
