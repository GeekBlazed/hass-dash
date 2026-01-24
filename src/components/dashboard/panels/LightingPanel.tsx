import { useMemo, useState } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ILightService } from '../../../interfaces/ILightService';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { LightDetailsPanel } from './LightDetailsPanel';

const getDisplayName = (entity: HaEntityState): string => {
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
};

export function LightingPanel({ isHidden = true }: { isHidden?: boolean }) {
  const lightService = useService<ILightService>(TYPES.ILightService);
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const householdEntityIds = useEntityStore((s) => s.householdEntityIds);
  const optimisticSetState = useEntityStore((s) => s.optimisticSetState);

  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

  const turnOff = (entityId: string): void => {
    void (async () => {
      const previousState = entitiesById[entityId]?.state;
      optimisticSetState(entityId, 'off');
      try {
        await lightService.turnOff(entityId);
      } catch {
        // Best-effort: avoid impacting the rest of the UI.
        if (typeof previousState === 'string') {
          optimisticSetState(entityId, previousState);
        }
      }
    })();
  };

  const onLights = useMemo(() => {
    const allLights = Object.values(entitiesById).filter((e) => e.entity_id.startsWith('light.'));
    const filtered =
      Object.keys(householdEntityIds).length > 0
        ? allLights.filter((e) => householdEntityIds[e.entity_id] === true)
        : allLights;

    return filtered
      .filter((e) => String(e.state).toLowerCase() === 'on')
      .map((e) => ({
        id: e.entity_id,
        name: getDisplayName(e),
        roomId: e.entity_id.startsWith('light.') ? e.entity_id.slice('light.'.length) : e.entity_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entitiesById, householdEntityIds]);

  const showEmpty = onLights.length === 0;

  return (
    <section
      id="lighting-panel"
      className={isHidden ? 'tile lighting-panel is-hidden' : 'tile lighting-panel'}
      aria-label="Lighting"
    >
      {selectedLightId ? (
        <LightDetailsPanel
          entityId={selectedLightId}
          onBack={() => {
            setSelectedLightId(null);
          }}
        />
      ) : (
        <>
          <ul id="lighting-list" aria-label="Lights currently on" data-managed-by="react">
            {onLights.map((light) => (
              <li key={light.id} className="lighting-item">
                <div className="lighting-item__row">
                  <button
                    type="button"
                    className="lighting-item__details"
                    onClick={() => {
                      setSelectedLightId(light.id);
                    }}
                    aria-label={`Open details for ${light.name ?? light.id}`}
                  >
                    <div className="lighting-name">{light.name ?? light.id}</div>
                    <div className="lighting-meta">{light.roomId.replace(/_/g, ' ')}</div>
                  </button>

                  <button
                    type="button"
                    className="lighting-item__button"
                    onClick={() => {
                      turnOff(light.id);
                    }}
                    onKeyDown={(e) => {
                      // In real browsers, <button> activates on Enter/Space, but our
                      // jsdom tests dispatch only a keydown and do not get a synthesized
                      // click. Handle keydown explicitly for accessibility + test parity.
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      turnOff(light.id);
                    }}
                    aria-label={`Turn off ${light.name ?? light.id}`}
                  >
                    Off
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div
            className={showEmpty ? 'lighting-panel__empty' : 'lighting-panel__empty is-hidden'}
            id="lighting-empty"
            data-managed-by="react"
          >
            There are no lights on.
          </div>
        </>
      )}
    </section>
  );
}
