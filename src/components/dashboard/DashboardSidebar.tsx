import { BrandHeader } from './panels/BrandHeader';
import { DashboardQuickActions } from './panels/DashboardQuickActions';
import { SidebarPanelHost } from './panels/SidebarPanelHost';
import { WeatherSummary } from './panels/WeatherSummary';

export function DashboardSidebar() {
  return (
    <aside className="sidebar" aria-label="Home controls">
      <BrandHeader />
      <WeatherSummary />
      <DashboardQuickActions />
      <SidebarPanelHost />
      <pre className="status-block" id="floorplan-status"></pre>
    </aside>
  );
}
