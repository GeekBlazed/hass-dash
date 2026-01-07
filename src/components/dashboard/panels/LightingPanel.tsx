export function LightingPanel({ isHidden = true }: { isHidden?: boolean }) {
  return (
    <section
      id="lighting-panel"
      className={isHidden ? 'tile lighting-panel is-hidden' : 'tile lighting-panel'}
      aria-label="Lighting"
    >
      <ul id="lighting-list" aria-label="Lights currently on"></ul>
      <div className="lighting-panel__empty is-hidden" id="lighting-empty">
        There are no lights on.
      </div>
    </section>
  );
}
