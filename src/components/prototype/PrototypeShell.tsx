import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAreaTemperature,
  normalizeClimate,
  type ClimateModel,
} from '../../features/prototype/model/climate';
import {
  getOnLights,
  normalizeLighting,
  type LightingModel,
} from '../../features/prototype/model/lighting';
import { parseYaml } from '../../features/prototype/parsing/parseYaml';

type SidebarPanel = 'agenda' | 'lighting' | 'media' | 'climate' | null;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
      <path fill="currentColor" d="M10.5 20v-6h3v6h4.5v-8h2L12 3 1 12h2v8z" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-11 w-11">
      <path
        fill="currentColor"
        d="M6 14.5a4.5 4.5 0 0 1 4.43-4.5A5.5 5.5 0 0 1 21 12.5a4.5 4.5 0 0 1-4.5 4.5H7.5A3.5 3.5 0 0 1 6 14.5zm4.5 4.5h2l-1 3h-2l1-3zm4 0h2l-1 3h-2l1-3z"
      />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        fill="currentColor"
        d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-20C8.13 1 5 4.13 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26C17.81 12.47 19 10.38 19 8c0-3.87-3.13-7-7-7z"
      />
    </svg>
  );
}

function ClimateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        fill="currentColor"
        d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9.04-18.95-1.41-1.41-1.8 1.79 1.42 1.42 1.79-1.8zM20 11v2h3v-2h-3zM6.76 19.16l-1.42-1.42-1.79 1.8 1.41 1.41 1.8-1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM12 6a6 6 0 1 0 0 12a6 6 0 0 0 0-12zm0-5h0v3h0V1z"
      />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        fill="currentColor"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
      />
    </svg>
  );
}

export function PrototypeShell() {
  // Prototype default: Climate panel visible
  const [activePanel, setActivePanel] = useState<SidebarPanel>('climate');

  const [lightingModel, setLightingModel] = useState<LightingModel>({ lights: [] });
  const lightingLoadedRef = useRef(false);

  const [climateModel, setClimateModel] = useState<ClimateModel>(() => normalizeClimate(null));
  const climateLoadedRef = useRef(false);

  const [view, setView] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  useEffect(() => {
    // Load prototype lighting YAML lazily when Lighting panel opens.
    if (activePanel !== 'lighting') return;
    if (lightingLoadedRef.current) return;
    if (typeof fetch !== 'function') return;

    lightingLoadedRef.current = true;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/prototype/lighting.yaml', { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to load lighting.yaml (${res.status})`);
        const text = await res.text();
        const doc = parseYaml(text);
        const model = normalizeLighting(doc);
        if (!controller.signal.aborted) setLightingModel(model);
      } catch {
        // Missing/unparseable YAML should behave like empty.
        if (!controller.signal.aborted) setLightingModel({ lights: [] });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [activePanel]);

  useEffect(() => {
    // Load prototype climate YAML lazily when Climate panel opens.
    if (activePanel !== 'climate') return;
    if (climateLoadedRef.current) return;
    if (typeof fetch !== 'function') return;

    climateLoadedRef.current = true;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/prototype/climate.yaml', { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to load climate.yaml (${res.status})`);
        const text = await res.text();
        const doc = parseYaml(text);
        const model = normalizeClimate(doc);
        if (!controller.signal.aborted) setClimateModel(model);
      } catch {
        // Missing/unparseable YAML should fall back to defaults.
        if (!controller.signal.aborted) setClimateModel(normalizeClimate(null));
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [activePanel]);

  const showClimateOverlay = activePanel === 'climate';
  const showLightingOverlay = activePanel === 'lighting';

  const onLights = useMemo(() => {
    return getOnLights(lightingModel);
  }, [lightingModel]);

  const thermostat = climateModel.thermostat;
  const climateSummary = useMemo(() => {
    const familyTemp = getAreaTemperature(climateModel, 'family_room');
    const kitchenTemp = getAreaTemperature(climateModel, 'kitchen');
    const bedroomTemp = getAreaTemperature(climateModel, 'bedroom');
    const officeTemp = getAreaTemperature(climateModel, 'office');

    const formatTemp = (value: number | undefined): string => {
      if (value === undefined) return `--${thermostat.unit}`;
      return `${Math.round(value)}${thermostat.unit}`;
    };

    return {
      familyTempLabel: formatTemp(familyTemp),
      kitchenTempLabel: formatTemp(kitchenTemp),
      bedroomTempLabel: formatTemp(bedroomTemp),
      officeTempLabel: formatTemp(officeTemp),
    };
  }, [climateModel, thermostat.unit]);

  const toggleLightLocal = (lightId: string) => {
    setLightingModel((prev) => ({
      ...prev,
      lights: prev.lights.map((l) => {
        if (l.id !== lightId) return l;
        return { ...l, state: l.state === 'on' ? 'off' : 'on' };
      }),
    }));
  };

  const viewportTransform = `translate(${view.x} ${view.y}) scale(${view.scale})`;

  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
  };

  const handleZoomIn = () => {
    setView((prev) => ({ ...prev, scale: clamp(Number((prev.scale + 0.1).toFixed(2)), 0.5, 2.5) }));
  };

  const handleZoomOut = () => {
    setView((prev) => ({ ...prev, scale: clamp(Number((prev.scale - 0.1).toFixed(2)), 0.5, 2.5) }));
  };

  const handleResetView = () => {
    setView({ x: 0, y: 0, scale: 1 });
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;

    // JSDOM may not implement pointer capture; browsers do.
    (
      event.currentTarget as unknown as { setPointerCapture?: (pointerId: number) => void }
    ).setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: view.x,
      initialY: view.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    setView((prev) => ({ ...prev, x: drag.initialX + dx, y: drag.initialY + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  const quickActionClassName = useMemo(() => {
    return (isExpanded: boolean): string => {
      const base =
        'bg-panel-surface/30 border-white/10 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 grid place-items-center rounded-[14px] border px-2 py-2 text-text-secondary transition duration-150';

      if (isExpanded) {
        return `${base} -translate-y-0.5 border-accent/30 bg-panel-surface/40`;
      }

      return `${base} hover:-translate-y-0.5 hover:border-accent/30 hover:bg-panel-surface/40`;
    };
  }, []);

  const handlePanelToggle = (panel: Exclude<SidebarPanel, null>) => {
    setActivePanel((current) => {
      // Match prototype behavior exactly
      if (panel === 'media') {
        return current === 'media' ? 'agenda' : 'media';
      }

      if (panel === 'climate') {
        return current === 'climate' ? 'agenda' : 'climate';
      }

      if (panel === 'lighting') {
        return current === 'lighting' ? null : 'lighting';
      }

      // agenda
      return current === 'agenda' ? null : 'agenda';
    });
  };

  return (
    <div
      data-testid="prototype-shell"
      className="bg-warm-gradient relative h-dvh w-dvw overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 16px)', maxWidth: 'calc(100vw - 16px)' }}
    >
      <div className="bg-accent/20 pointer-events-none absolute -inset-24 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 to-black/30" />

      <div className="relative z-10 grid h-full min-h-0 grid-cols-[320px_1fr] gap-[22px] p-0">
        {/* Sidebar */}
        <aside
          className="bg-panel-bg/55 flex min-h-0 flex-col gap-4 rounded-[18px] border border-white/10 p-5 shadow-xl backdrop-blur-md"
          aria-label="Home controls"
        >
          {/* Brand */}
          <div className="flex items-center gap-3 px-1 pb-4">
            <div className="text-text-primary/90" aria-hidden="true">
              <HomeIcon />
            </div>
            <h1 className="text-text-primary text-[26px] font-semibold tracking-[0.2px]">Home</h1>
          </div>

          <div className="h-px bg-white/10" />

          {/* Weather (static for now) */}
          <section
            aria-label="Weather summary"
            className="bg-panel-surface/30 grid grid-cols-[44px_1fr] items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 backdrop-blur-md"
          >
            <div className="text-text-primary/90" aria-hidden="true">
              <WeatherIcon />
            </div>
            <div>
              <div className="text-text-primary text-[34px] leading-none tracking-[0.2px]">
                89°F
              </div>
              <div className="text-text-secondary mt-1 text-[13px]">
                Breezy and foggy for the hour
              </div>
              <div className="text-text-muted mt-0.5 text-xs tracking-[0.2px]">Humidity: 97%</div>
            </div>
          </section>

          {/* Quick actions */}
          <nav aria-label="Quick actions" className="grid grid-cols-3 gap-[14px] px-1 pt-1">
            <button
              type="button"
              aria-label="Lighting"
              aria-controls="lighting-panel"
              aria-expanded={activePanel === 'lighting'}
              className={quickActionClassName(activePanel === 'lighting')}
              onClick={() => handlePanelToggle('lighting')}
            >
              <span className="text-text-primary/90" aria-hidden="true">
                <LightIcon />
              </span>
              <span className="mt-1 text-[13px] tracking-[0.2px]">Lighting</span>
            </button>

            <button
              type="button"
              aria-label="Climate"
              aria-controls="climate-panel"
              aria-expanded={activePanel === 'climate'}
              className={quickActionClassName(activePanel === 'climate')}
              onClick={() => handlePanelToggle('climate')}
            >
              <span className="text-text-primary/90" aria-hidden="true">
                <ClimateIcon />
              </span>
              <span className="mt-1 text-[13px] tracking-[0.2px]">Climate</span>
            </button>

            <button
              type="button"
              aria-label="Media"
              aria-controls="media-panel"
              aria-expanded={activePanel === 'media'}
              className={quickActionClassName(activePanel === 'media')}
              onClick={() => handlePanelToggle('media')}
            >
              <span className="text-text-primary/90" aria-hidden="true">
                <MediaIcon />
              </span>
              <span className="mt-1 text-[13px] tracking-[0.2px]">Media</span>
            </button>

            <a
              href="#top"
              aria-label="Security (prototype)"
              className={quickActionClassName(false)}
            >
              <span className="bg-panel-border-light h-6 w-6 rounded" aria-hidden="true" />
              <span className="mt-1 text-[13px] tracking-[0.2px]">Security</span>
            </a>

            <a href="#top" aria-label="Cameras (prototype)" className={quickActionClassName(false)}>
              <span className="bg-panel-border-light h-6 w-6 rounded" aria-hidden="true" />
              <span className="mt-1 text-[13px] tracking-[0.2px]">Cameras</span>
            </a>

            <button
              type="button"
              aria-label="Agenda"
              aria-controls="agenda-panel"
              aria-expanded={activePanel === 'agenda'}
              className={quickActionClassName(activePanel === 'agenda')}
              onClick={() => handlePanelToggle('agenda')}
            >
              <span className="text-text-primary/90" aria-hidden="true">
                <AgendaIcon />
              </span>
              <span className="mt-1 text-[13px] tracking-[0.2px]">Agenda</span>
            </button>
          </nav>

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
                  <div className="text-text-primary text-sm tracking-[0.2px]">
                    Lunch at the park
                  </div>
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
                          onClick={() => toggleLightLocal(light.id)}
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
                <div className="text-text-muted text-sm">Jimmi Hendrix</div>
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

        {/* Stage */}
        <main
          aria-label="Stage"
          data-testid="prototype-stage"
          className="bg-panel-bg/50 relative min-h-0 overflow-hidden rounded-[18px] border border-white/10 shadow-xl backdrop-blur-md"
        >
          <div
            className="absolute inset-0 p-[22px] pb-[26px]"
            aria-label="Interactive SVG floorplan"
          >
            <svg
              data-testid="floorplan-svg"
              viewBox="0 0 1000 650"
              className="h-full w-full"
              role="img"
              aria-label="Floorplan"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <g data-testid="floorplan-viewport" transform={viewportTransform}>
                {/* Base rooms layer */}
                <g data-testid="base-layer">
                  <rect x="60" y="60" width="420" height="260" rx="16" fill="rgba(21,21,21,0.85)" />
                  <rect
                    x="520"
                    y="60"
                    width="420"
                    height="260"
                    rx="16"
                    fill="rgba(21,21,21,0.85)"
                  />
                  <rect
                    x="60"
                    y="350"
                    width="420"
                    height="240"
                    rx="16"
                    fill="rgba(21,21,21,0.85)"
                  />
                  <rect
                    x="520"
                    y="350"
                    width="420"
                    height="240"
                    rx="16"
                    fill="rgba(21,21,21,0.85)"
                  />

                  <text x="90" y="120" fill="rgba(234,231,223,0.9)" fontSize="22">
                    Living Room
                  </text>
                  <text x="550" y="120" fill="rgba(234,231,223,0.9)" fontSize="22">
                    Kitchen
                  </text>
                  <text x="90" y="410" fill="rgba(234,231,223,0.9)" fontSize="22">
                    Bedroom
                  </text>
                  <text x="550" y="410" fill="rgba(234,231,223,0.9)" fontSize="22">
                    Office
                  </text>
                </g>

                {/* Climate overlay layer */}
                <g
                  data-testid="climate-overlay"
                  className={showClimateOverlay ? '' : 'hidden'}
                  aria-label="Climate overlay"
                >
                  <text x="90" y="160" fill="rgba(185,182,175,0.95)" fontSize="18">
                    {climateSummary.familyTempLabel}
                  </text>
                  <text x="550" y="160" fill="rgba(185,182,175,0.95)" fontSize="18">
                    {climateSummary.kitchenTempLabel}
                  </text>
                  <text x="90" y="450" fill="rgba(185,182,175,0.95)" fontSize="18">
                    {climateSummary.bedroomTempLabel}
                  </text>
                  <text x="550" y="450" fill="rgba(185,182,175,0.95)" fontSize="18">
                    {climateSummary.officeTempLabel}
                  </text>
                </g>

                {/* Lighting overlay layer */}
                <g data-testid="lighting-overlay" className={showLightingOverlay ? '' : 'hidden'}>
                  <circle cx="440" cy="290" r="12" fill="rgba(255,182,92,0.85)" />
                  <circle cx="900" cy="290" r="12" fill="rgba(255,182,92,0.85)" />
                  <circle cx="440" cy="560" r="12" fill="rgba(255,182,92,0.85)" />
                  <circle cx="900" cy="560" r="12" fill="rgba(255,182,92,0.85)" />
                </g>
              </g>
            </svg>
          </div>

          <div
            className="absolute right-[18px] bottom-[18px] flex flex-col gap-2"
            role="group"
            aria-label="Map controls"
          >
            <button
              type="button"
              onClick={handleZoomIn}
              className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Reset view"
            >
              ↺
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
