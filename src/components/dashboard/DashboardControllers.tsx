import { ConnectivityController } from './ConnectivityController';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';
import { HomeAssistantEntityStoreController } from './HomeAssistantEntityStoreController';

export function DashboardControllers() {
  return (
    <>
      <HaLightHotwireBridge />
      <ConnectivityController />
      <HomeAssistantEntityStoreController />
      <DeviceLocationTrackingController />
    </>
  );
}
