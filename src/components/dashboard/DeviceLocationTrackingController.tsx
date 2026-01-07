import { useEffect } from 'react';

import { TYPES } from '../../core/types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useService } from '../../hooks/useService';
import type { IEntityService } from '../../interfaces/IEntityService';
import { DeviceLocationTrackingService } from '../../services/DeviceLocationTrackingService';
import { useDeviceLocationStore } from '../../stores/useDeviceLocationStore';

export function DeviceLocationTrackingController({
  entityService: entityServiceOverride,
}: {
  entityService?: IEntityService;
}) {
  const { isEnabled: trackingEnabled } = useFeatureFlag('DEVICE_TRACKING');
  const { isEnabled: haEnabled } = useFeatureFlag('HA_CONNECTION');

  const diEntityService = useService<IEntityService>(TYPES.IEntityService);
  const entityService = entityServiceOverride ?? diEntityService;

  useEffect(() => {
    if (!trackingEnabled || !haEnabled) return;

    const service = new DeviceLocationTrackingService(entityService, {
      upsert: (entityId, location) => {
        useDeviceLocationStore.getState().upsert(entityId, location);
      },
    });

    void service.start();

    return () => {
      void service.stop();
    };
  }, [trackingEnabled, haEnabled, entityService]);

  return null;
}
