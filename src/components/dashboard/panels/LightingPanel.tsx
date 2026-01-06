export function LightingPanel() {
  return (
    <section id="lighting-panel" className="tile lighting-panel is-hidden" aria-label="Lighting">
      <ul id="lighting-list" aria-label="Lights currently on"></ul>
      <div className="lighting-panel__empty is-hidden" id="lighting-empty">
        There are no lights on.
      </div>
    </section>
  );
}
