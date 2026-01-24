import { useDashboardStore } from '../../../stores/useDashboardStore';

export function DashboardQuickActions() {
  const activePanel = useDashboardStore((state) => state.activePanel);
  const setActivePanel = useDashboardStore((state) => state.setActivePanel);
  const setOverlayEnabled = useDashboardStore((state) => state.setOverlayEnabled);

  const togglePanel = (panel: Exclude<typeof activePanel, null>) => {
    const isClosing = activePanel === panel;
    const nextPanel = isClosing ? null : panel;
    setActivePanel(nextPanel);

    // Prototype parity: quick actions drive which overlay is visible.
    // Lighting and climate are mutually exclusive on the map.
    if (panel === 'lighting') {
      if (isClosing) {
        setOverlayEnabled('lighting', false);
        setOverlayEnabled('climate', true);
      } else {
        setOverlayEnabled('lighting', true);
        setOverlayEnabled('climate', false);
      }
    }

    if (panel === 'climate') {
      setOverlayEnabled('lighting', false);
      setOverlayEnabled('climate', true);
    }
  };

  return (
    <div className="quick-actions" aria-label="Quick actions">
      <button
        className="qa"
        type="button"
        id="lighting-toggle"
        aria-label="Lighting"
        aria-controls="lighting-panel"
        aria-expanded={activePanel === 'lighting'}
        onClick={() => togglePanel('lighting')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-lighting" />
        </svg>
        <div className="label">Lighting</div>
      </button>
      <button
        className="qa"
        type="button"
        id="climate-toggle"
        aria-label="Climate"
        aria-controls="climate-panel"
        aria-expanded={activePanel === 'climate'}
        onClick={() => togglePanel('climate')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-climate" />
        </svg>
        <div className="label">Climate</div>
      </button>
      <button
        className="qa"
        type="button"
        id="media-toggle"
        aria-label="Media"
        aria-controls="media-window"
        aria-expanded={activePanel === 'media'}
        onClick={() => togglePanel('media')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-media" />
        </svg>
        <div className="label">Media</div>
      </button>
      <button className="qa" type="button" aria-label="Security" aria-disabled="true" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-security" />
        </svg>
        <div className="label">Security</div>
      </button>
      <a className="qa" href="#top" aria-label="Cameras">
        <svg viewBox="0 0 401.931 401.931" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-cameras" />
        </svg>
        <div className="label">Cameras</div>
      </a>
      <button
        className="qa"
        type="button"
        id="agenda-toggle"
        aria-label="Agenda"
        aria-controls="agenda"
        aria-expanded={activePanel === 'agenda'}
        onClick={() => togglePanel('agenda')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/icons/quick-actions.svg#qa-agenda" />
        </svg>
        <div className="label">Agenda</div>
      </button>
    </div>
  );
}
