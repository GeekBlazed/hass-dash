import { Icon } from '@iconify/react';
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
        <Icon
          icon="mdi:lightbulb-group"
          aria-hidden="true"
          data-testid="lighting-icon"
          className="lighting-icon"
        />
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
        <Icon
          icon="mdi:home-climate"
          aria-hidden="true"
          data-testid="climate-icon"
          className="climate-icon"
        />
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
        <Icon
          icon="mdi:multimedia"
          aria-hidden="true"
          data-testid="media-icon"
          className="media-icon"
        />
        <div className="label">Media</div>
      </button>
      <button className="qa" type="button" aria-label="Security" aria-disabled="true" disabled>
        <Icon
          icon="mdi:security-home"
          aria-hidden="true"
          data-testid="security-icon"
          className="security-icon"
        />
        <div className="label">Security</div>
      </button>
      <button
        className="qa"
        type="button"
        id="cameras-toggle"
        aria-label="Cameras"
        aria-controls="cameras-panel"
        aria-expanded={activePanel === 'cameras'}
        onClick={() => togglePanel('cameras')}
      >
        <Icon
          icon="mdi:cctv"
          aria-hidden="true"
          data-testid="cameras-icon"
          className="cameras-icon"
        />
        <div className="label">Cameras</div>
      </button>
      <button
        className="qa"
        type="button"
        id="agenda-toggle"
        aria-label="Agenda"
        aria-controls="agenda"
        aria-expanded={activePanel === 'agenda'}
        onClick={() => togglePanel('agenda')}
      >
        <Icon
          icon="mdi:calendar-check-outline"
          aria-hidden="true"
          data-testid="agenda-icon"
          className="agenda-icon"
        />
        <div className="label">Agenda</div>
      </button>
    </div>
  );
}
