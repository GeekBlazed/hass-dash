import { useEffect, useMemo, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

function isStandaloneDisplayMode(): boolean {
  if (typeof window !== 'object') return false;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  return isStandalone || isIosStandalone;
}

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode());
  const canInstall = useMemo(
    () => deferredPrompt !== null && !isInstalled,
    [deferredPrompt, isInstalled]
  );

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Required to keep the event for later use (custom install UI).
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const onInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className="brand-action"
      aria-label="Install app"
      onClick={onInstall}
      style={{ marginLeft: 'auto' }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M5 20h14v-2H5v2zm7-18-5.5 5.5 1.42 1.42L11 6.84V16h2V6.84l3.08 3.08 1.42-1.42L12 2z"
        />
      </svg>
    </button>
  );
}
