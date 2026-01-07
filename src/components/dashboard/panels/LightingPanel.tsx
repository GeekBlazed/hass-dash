import { useMemo } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';

export function LightingPanel({ isHidden = true }: { isHidden?: boolean }) {
  const lights = useDashboardStore((s) => s.lighting.lights);
  const setLightOn = useDashboardStore((s) => s.setLightOn);

  const onLights = useMemo(() => {
    return Object.values(lights).filter((l) => l.state === 'on');
  }, [lights]);

  const showEmpty = onLights.length === 0;

  return (
    <section
      id="lighting-panel"
      className={isHidden ? 'tile lighting-panel is-hidden' : 'tile lighting-panel'}
      aria-label="Lighting"
    >
      <ul id="lighting-list" aria-label="Lights currently on">
        {onLights.map((light) => (
          <li key={light.id}>
            <button type="button" onClick={() => setLightOn(light.id, false)}>
              {light.name ?? light.id}
            </button>
          </li>
        ))}
      </ul>

      <div
        className={showEmpty ? 'lighting-panel__empty' : 'lighting-panel__empty is-hidden'}
        id="lighting-empty"
      >
        There are no lights on.
      </div>
    </section>
  );
}
