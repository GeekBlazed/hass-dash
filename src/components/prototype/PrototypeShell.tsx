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

import { PrototypeSidebar } from './PrototypeSidebar';
import { PrototypeStage } from './PrototypeStage';

import './prototype-primitives.css';
import './prototype-sidebar.css';

type SidebarPanel = 'agenda' | 'lighting' | 'media' | 'climate' | null;

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
        const res = await fetch('/UI/lighting.yaml', { signal: controller.signal });
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
        const res = await fetch('/UI/climate.yaml', { signal: controller.signal });
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
      className="prototype-root prototype-shell-clamp bg-warm-gradient relative h-dvh w-dvw overflow-hidden"
    >
      {/* Prototype-style background glows + vignette (no extra layout/frame). */}
      <div className="prototype-glows pointer-events-none absolute inset-0" />
      <div className="prototype-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 to-black/25" />

      <div className="relative z-10 grid h-full min-h-0 grid-cols-[320px_1fr] gap-[22px] p-0">
        <PrototypeSidebar
          activePanel={activePanel}
          onPanelToggle={handlePanelToggle}
          onLights={onLights}
          onToggleLight={toggleLightLocal}
          thermostat={thermostat}
        />

        <PrototypeStage
          view={view}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          showClimateOverlay={showClimateOverlay}
          showLightingOverlay={showLightingOverlay}
          climateSummary={climateSummary}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
        />
      </div>
    </div>
  );
}
