import { spawnSync } from 'node:child_process';

const spec = 'e2e/notification-toasts.max-visible.spec.ts';
const thresholds = ['1', '2'];

for (const threshold of thresholds) {
  const result = spawnSync('pnpm', ['playwright', 'test', spec], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PW_TOAST_MAX_VISIBLE: threshold,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
