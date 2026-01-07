interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = 'Loading' }: LoadingSpinnerProps): React.ReactElement {
  return (
    <div className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <div
        className="border-t-primary h-5 w-5 animate-spin rounded-full border-2 border-gray-300"
        aria-hidden="true"
      />
      <span className="text-text-secondary text-sm">{label}</span>
    </div>
  );
}
