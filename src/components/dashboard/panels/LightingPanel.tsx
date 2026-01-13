import { useMemo } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { IHomeAssistantClient } from '../../../interfaces/IHomeAssistantClient';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';

const getDisplayName = (entity: HaEntityState): string => {
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
};

export function LightingPanel({ isHidden = true }: { isHidden?: boolean }) {
  const haClient = useService<IHomeAssistantClient>(TYPES.IHomeAssistantClient);
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const householdEntityIds = useEntityStore((s) => s.householdEntityIds);
  const optimisticSetState = useEntityStore((s) => s.optimisticSetState);

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
      <ul id="lighting-list" aria-label="Lights currently on" data-managed-by="react">
        {onLights.map((light) => (
          <li
            key={light.id}
            className="lighting-item"
            role="button"
            tabIndex={0}
            onClick={() => {
              void (async () => {
                const previousState = entitiesById[light.id]?.state;
                optimisticSetState(light.id, 'off');
                try {
                  await haClient.connect();
                  await haClient.callService({
                    domain: 'light',
                    service: 'turn_off',
                    service_data: { entity_id: light.id },
                    target: { entity_id: light.id },
                  });
                } catch {
                  // Best-effort: avoid impacting the rest of the UI.
                  if (typeof previousState === 'string') {
                    optimisticSetState(light.id, previousState);
                  }
                }
              })();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void (async () => {
                  const previousState = entitiesById[light.id]?.state;
                  optimisticSetState(light.id, 'off');
                  try {
                    await haClient.connect();
                    await haClient.callService({
                      domain: 'light',
                      service: 'turn_off',
                      service_data: { entity_id: light.id },
                      target: { entity_id: light.id },
                    });
                  } catch {
                    // Best-effort: avoid impacting the rest of the UI.
                    if (typeof previousState === 'string') {
                      optimisticSetState(light.id, previousState);
                    }
                  }
                })();
              }
            }}
            aria-label={`Turn off ${light.name ?? light.id}`}
          >
            <div className="lighting-name">{light.name ?? light.id}</div>
            <div className="lighting-meta">{light.roomId.replace(/_/g, ' ')}</div>
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
    </section>
  );
}
