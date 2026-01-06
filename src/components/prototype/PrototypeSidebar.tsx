import type { ThermostatModel } from '../../features/prototype/model/climate';

type SidebarPanel = 'agenda' | 'lighting' | 'media' | 'climate' | null;

type OnLight = {
  id: string;
  name: string;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M10.5 20v-6h3v6h4.5v-8h2L12 3 1 12h2v8z" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 14.5a4.5 4.5 0 0 1 4.43-4.5A5.5 5.5 0 0 1 21 12.5a4.5 4.5 0 0 1-4.5 4.5H7.5A3.5 3.5 0 0 1 6 14.5zm4.5 4.5h2l-1 3h-2l1-3zm4 0h2l-1 3h-2l1-3z"
      />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-20C8.13 1 5 4.13 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26C17.81 12.47 19 10.38 19 8c0-3.87-3.13-7-7-7z"
      />
    </svg>
  );
}

function ClimateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9.04-18.95-1.41-1.41-1.8 1.79 1.42 1.42 1.79-1.8zM20 11v2h3v-2h-3zM6.76 19.16l-1.42-1.42-1.79 1.8 1.41 1.41 1.8-1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM12 6a6 6 0 1 0 0 12a6 6 0 0 0 0-12zm0-5h0v3h0V1z"
      />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H4zm0 2h10v10H4V7z"
      />
      <path fill="currentColor" d="M9 10.2v3.6L12 12l-3-1.8z" />
    </svg>
  );
}

function AgendaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
      />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1l9 4v6c0 5.55-3.84 10.74-9 12c-5.16-1.26-9-6.45-9-12V5l9-4zm0 2.18L5 6.09V11c0 4.5 3.02 8.82 7 9.93c3.98-1.11 7-5.43 7-9.93V6.09l-7-2.91z"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 9a4 4 0 1 0 0 8a4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4z"
      />
      <path fill="currentColor" d="M4 7h3l2-2h6l2 2h3v14H4V7zm2 2v10h12V9H6z" />
    </svg>
  );
}

export interface PrototypeSidebarProps {
  activePanel: SidebarPanel;
  onPanelToggle: (panel: Exclude<SidebarPanel, null>) => void;
  onLights: OnLight[];
  onToggleLight: (lightId: string) => void;
  thermostat: ThermostatModel;
}

export function PrototypeSidebar({
  activePanel,
  onPanelToggle,
  onLights,
  onToggleLight,
  thermostat,
}: PrototypeSidebarProps) {
  const isExpanded = (panel: Exclude<SidebarPanel, null>): boolean => {
    return activePanel === panel;
  };

  return (
    <aside className="sidebar" aria-label="Home controls">
      <div className="brand">
        <HomeIcon />
        <div className="title">Home</div>
      </div>

      <div className="weather" aria-label="Weather summary">
        <WeatherIcon />
        <div>
          <div className="temp">89°F</div>
          <div className="desc">Breezy and foggy for the hour</div>
          <div className="meta">Humidity: 97%</div>
        </div>
      </div>

      <div className="quick-actions" aria-label="Quick actions">
        <button
          className="qa"
          type="button"
          id="lighting-toggle"
          aria-label="Lighting"
          aria-controls="lighting-panel"
          aria-expanded={isExpanded('lighting')}
          onClick={() => onPanelToggle('lighting')}
        >
          <LightIcon />
          <div className="label">Lighting</div>
        </button>

        <button
          className="qa"
          type="button"
          id="climate-toggle"
          aria-label="Climate"
          aria-controls="climate-panel"
          aria-expanded={isExpanded('climate')}
          onClick={() => onPanelToggle('climate')}
        >
          <ClimateIcon />
          <div className="label">Climate</div>
        </button>

        <button
          className="qa"
          type="button"
          id="media-toggle"
          aria-label="Media"
          aria-controls="media-panel"
          aria-expanded={isExpanded('media')}
          onClick={() => onPanelToggle('media')}
        >
          <MediaIcon />
          <div className="label">Media</div>
        </button>

        <a className="qa" href="#top" aria-label="Security (prototype)">
          <SecurityIcon />
          <div className="label">Security</div>
        </a>

        <a className="qa" href="#top" aria-label="Cameras (prototype)">
          <CameraIcon />
          <div className="label">Cameras</div>
        </a>

        <button
          className="qa"
          type="button"
          id="agenda-toggle"
          aria-label="Agenda"
          aria-controls="agenda-panel"
          aria-expanded={isExpanded('agenda')}
          onClick={() => onPanelToggle('agenda')}
        >
          <AgendaIcon />
          <div className="label">Agenda</div>
        </button>
      </div>

      {/* Panels (mutually exclusive) */}
      <div className="min-h-0 flex-1 px-1 pt-2">
        <section
          id="agenda-panel"
          aria-label="Agenda"
          hidden={activePanel !== 'agenda'}
          className="min-h-0 overflow-auto pt-2"
        >
          <div className="space-y-2">
            <div className="bg-panel-surface/20 rounded-[14px] border border-white/5 px-3 py-2">
              <div className="text-text-primary text-sm tracking-[0.2px]">Weekend In</div>
              <div className="text-text-muted text-xs">Until 7:00 PM</div>
            </div>
            <div className="bg-panel-surface/20 rounded-[14px] border border-white/5 px-3 py-2">
              <div className="text-text-primary text-sm tracking-[0.2px]">Lunch at the park</div>
              <div className="text-text-muted text-xs">11:00 AM – 2:00 PM</div>
            </div>
          </div>
        </section>

        <section
          id="lighting-panel"
          aria-label="Lighting"
          hidden={activePanel !== 'lighting'}
          className="min-h-0 overflow-auto pt-2"
        >
          <div className="bg-panel-surface/20 rounded-[14px] border border-white/5 p-3">
            {onLights.length === 0 ? (
              <div className="text-text-muted text-xs tracking-[0.2px]">
                There are no lights on.
              </div>
            ) : (
              <ul className="space-y-3" aria-label="On lights">
                {onLights.map((light) => (
                  <li key={light.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-text-primary truncate font-medium">{light.name}</div>
                      <div className="text-text-muted text-xs">{light.id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleLight(light.id)}
                      className="bg-panel-surface/30 text-text-secondary hover:border-accent/30 focus-visible:ring-accent/50 rounded-[14px] border border-white/10 px-3 py-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={`Turn off ${light.name}`}
                    >
                      Turn off
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          id="media-panel"
          aria-label="Media player"
          hidden={activePanel !== 'media'}
          className="min-h-0 overflow-auto pt-2"
        >
          <div className="bg-panel-surface/20 rounded-[14px] border border-white/5 p-3">
            <div className="text-text-primary font-medium">Spotify</div>
            <div className="text-text-muted mt-2 text-sm">All Along the Wa...</div>
            <div className="text-text-muted text-sm">Jimi Hendrix</div>
          </div>
        </section>

        <section
          id="climate-panel"
          aria-label="Climate controls"
          hidden={activePanel !== 'climate'}
          className="min-h-0 overflow-auto pt-2"
        >
          <div className="space-y-3">
            <div className="bg-panel-surface/20 rounded-[14px] border border-white/5 p-3">
              <div className="text-text-primary text-[34px] leading-none tracking-[0.2px]">
                {Math.round(thermostat.measuredTemperature)}
                {thermostat.unit}
              </div>
              <div className="text-text-muted mt-2 text-xs tracking-[0.2px]">
                <div>
                  <span className="font-semibold">Humidity</span>:{' '}
                  {thermostat.measuredHumidity !== undefined
                    ? `${Math.round(thermostat.measuredHumidity)}%`
                    : '—'}
                </div>
                <div>
                  <span className="font-semibold">Mode</span>: {thermostat.hvacMode}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
