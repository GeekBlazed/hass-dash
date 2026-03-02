const FALLBACK_VERSION = '0.1.0';

export function getAppVersion(): string {
  const envVersion = import.meta.env.VITE_APP_VERSION?.trim();
  if (envVersion) return envVersion;

  if (typeof __APP_VERSION__ === 'string') {
    const buildVersion = __APP_VERSION__.trim();
    if (buildVersion) return buildVersion;
  }

  return FALLBACK_VERSION;
}
