interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

interface QuickActionsProps {
  onAction?: (actionId: string) => void;
}

function PowerIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="14" cy="14" r="10" />
      <line x1="14" y1="4" x2="14" y2="0" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="14" cy="14" r="6" />
      <line x1="14" y1="2" x2="14" y2="0" />
      <line x1="26" y1="14" x2="28" y2="14" />
      <line x1="14" y1="26" x2="14" y2="28" />
      <line x1="2" y1="14" x2="0" y2="14" />
    </svg>
  );
}

function WarmIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="14" cy="14" r="6" />
      <path d="M14,20 a10,10 0 0 0 10,6" />
    </svg>
  );
}

function ScenesIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="8" y="8" width="14" height="12" rx="2" />
      <rect x="4" y="4" width="14" height="12" rx="2" />
    </svg>
  );
}

const defaultActions: QuickAction[] = [
  { id: 'all-off', label: 'All Off', icon: <PowerIcon /> },
  { id: 'bright', label: 'Bright', icon: <SunIcon /> },
  { id: 'warm', label: 'Warm', icon: <WarmIcon />, active: true },
  { id: 'scenes', label: 'Scenes', icon: <ScenesIcon /> },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      {defaultActions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction?.(action.id)}
          className={`focus:ring-accent/50 flex h-11 items-center gap-3 rounded-lg border px-4 transition-all duration-150 focus:ring-2 focus:outline-none ${
            action.active
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-panel-border-light bg-panel-card text-text-primary hover:border-panel-border-light hover:bg-panel-surface'
          } `}
        >
          <span className={action.active ? 'text-accent' : 'text-text-primary'}>{action.icon}</span>
          <span className="text-lg font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
