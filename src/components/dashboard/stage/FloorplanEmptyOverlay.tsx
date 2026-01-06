export function FloorplanEmptyOverlay() {
  return (
    <div className="floorplan-empty is-hidden" id="floorplan-empty" role="alert" aria-live="polite">
      <div className="floorplan-empty__panel">
        <h2 className="floorplan-empty__title">Floorplan not loaded</h2>
        <p className="floorplan-empty__body" id="floorplan-empty-message"></p>
        <div className="floorplan-empty__actions">
          <button className="floorplan-empty__btn" id="floorplan-retry" type="button">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
