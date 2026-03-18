import { ConnectivityController } from './ConnectivityController';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';
import { HomeAssistantEntityStoreController } from './HomeAssistantEntityStoreController';
import { NotificationController } from './NotificationController';

export function DashboardControllers() {
  return (
    <>
      <HaLightHotwireBridge />
      <ConnectivityController />
      <HomeAssistantEntityStoreController />
      <DeviceLocationTrackingController />
      <NotificationController />
    </>
  );
}
