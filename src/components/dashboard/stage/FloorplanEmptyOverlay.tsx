export function FloorplanEmptyOverlay({
  isHidden,
  message,
  onRetry,
}: {
  isHidden: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={isHidden ? 'floorplan-empty is-hidden' : 'floorplan-empty'}
      id="floorplan-empty"
      role="alert"
      aria-live="polite"
    >
      <div className="floorplan-empty__panel">
        <h2 className="floorplan-empty__title">Floorplan not loaded</h2>
        <p className="floorplan-empty__body" id="floorplan-empty-message">
          {message}
        </p>
        <div className="floorplan-empty__actions">
          <button
            className="floorplan-empty__btn"
            id="floorplan-retry"
            type="button"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
