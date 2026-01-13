import { useEffect } from 'react';
import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IHomeAssistantClient } from '../../interfaces/IHomeAssistantClient';

type HassDashToggleLightEvent = CustomEvent<{ entityId?: string }>;

export function HaLightHotwireBridge() {
  const homeAssistantClient = useService<IHomeAssistantClient>(TYPES.IHomeAssistantClient);

  useEffect(() => {
    let disposed = false;

    const handler = (event: Event) => {
      const e = event as HassDashToggleLightEvent;
      const entityId = e.detail?.entityId;
      if (!entityId || !entityId.startsWith('light.')) return;

      void (async () => {
        try {
          await homeAssistantClient.connect();
          if (disposed) return;

          await homeAssistantClient.callService({
            domain: 'light',
            service: 'toggle',
            service_data: { entity_id: entityId },
          });
        } catch {
          // Hotwire demo: ignore errors to avoid impacting the UI.
        }
      })();
    };

    window.addEventListener('hass-dash:toggle-light', handler);
    return () => {
      disposed = true;
      window.removeEventListener('hass-dash:toggle-light', handler);
    };
  }, [homeAssistantClient]);

  return null;
}
