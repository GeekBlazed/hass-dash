import fs from 'node:fs';
import path from 'node:path';

function pct(score) {
  return Math.round(score * 100);
}

function safeRoundMs(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
  return Math.round(v);
}

function main() {
  const dir = path.join(process.cwd(), 'lighthouseci');
  if (!fs.existsSync(dir)) {
    console.log('No lighthouseci/ directory found.');
    process.exitCode = 1;
    return;
  }

  const reportFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.report.json'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  const latest = reportFiles[0];
  if (!latest) {
    console.log('No *.report.json files found in lighthouseci/.');
    process.exitCode = 1;
    return;
  }

  const report = JSON.parse(fs.readFileSync(latest, 'utf8'));

  const categories = report.categories;
  const audits = report.audits;

  console.log('Latest report:', path.basename(latest));
  console.log('Scores:', {
    performance: pct(categories.performance.score),
    accessibility: pct(categories.accessibility.score),
    bestPractices: pct(categories['best-practices'].score),
    seo: pct(categories.seo.score),
  });

  console.log('Metrics(ms):', {
    fcp: safeRoundMs(audits['first-contentful-paint']?.numericValue),
    lcp: safeRoundMs(audits['largest-contentful-paint']?.numericValue),
    tbt: safeRoundMs(audits['total-blocking-time']?.numericValue),
    cls: audits['cumulative-layout-shift']?.numericValue,
  });

  const unusedJs = audits['unused-javascript'];
  if (unusedJs?.details?.items?.length) {
    const items = unusedJs.details.items
      .map((i) => ({
        url: i.url,
        wastedKiB: Math.round((i.wastedBytes ?? 0) / 1024),
        totalKiB: Math.round((i.totalBytes ?? 0) / 1024),
      }))
      .sort((a, b) => b.wastedKiB - a.wastedKiB)
      .slice(0, 12);

    console.log('Top unused JS:');
    for (const it of items) {
      console.log(`- ${it.wastedKiB}KiB unused of ${it.totalKiB}KiB ${it.url}`);
    }
  } else {
    console.log('No unused-javascript items.');
  }

  const rbr = audits['render-blocking-resources'];
  if (rbr?.details?.items?.length) {
    const items = rbr.details.items
      .map((i) => ({ url: i.url, totalBytes: i.totalBytes, wastedMs: i.wastedMs }))
      .sort((a, b) => (b.wastedMs ?? 0) - (a.wastedMs ?? 0))
      .slice(0, 8);

    console.log('Render blocking resources:');
    for (const it of items) {
      console.log(
        `- ${it.wastedMs ?? 0}ms est ${Math.round((it.totalBytes ?? 0) / 1024)}KiB ${it.url}`
      );
    }
  }
}

main();
