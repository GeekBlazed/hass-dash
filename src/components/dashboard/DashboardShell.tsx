import { DashboardSidebar } from './DashboardSidebar';
import { DashboardStage } from './DashboardStage';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';

export function DashboardShell() {
  return (
    <div className="viewport">
      <HaLightHotwireBridge />
      <div className="frame" role="application" aria-label="Floorplan prototype">
        <div className="app">
          <DashboardSidebar />
          <DashboardStage />
        </div>
      </div>
    </div>
  );
}
