import { useConnectivityStore } from '../../../stores/useConnectivityStore';

export function OfflineIndicator() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const haConnected = useConnectivityStore((s) => s.haConnected);

  const show = !isOnline || !haConnected;
  if (!show) return null;

  const label = !isOnline ? 'Offline' : 'Disconnected';

  return (
    <div
      className="border-panel-border bg-panel-card text-2xs text-text-secondary ml-2 rounded-full border px-2 py-0.5"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
