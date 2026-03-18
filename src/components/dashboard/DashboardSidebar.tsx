import { BrandHeader } from './panels/BrandHeader';
import { Clock } from './panels/Clock.tsx';
import { DashboardQuickActions } from './panels/DashboardQuickActions';
import { SidebarPanelHost } from './panels/SidebarPanelHost';
import { WeatherSummary } from './panels/WeatherSummary';
import { PersistentNotificationsControl } from './PersistentNotificationsControl';

export function DashboardSidebar() {
  return (
    <aside className="sidebar" aria-label="Home controls">
      <BrandHeader />
      <Clock />
      <WeatherSummary />
      <DashboardQuickActions />
      <PersistentNotificationsControl />
      <SidebarPanelHost />
      <pre className="status-block" id="floorplan-status"></pre>
    </aside>
  );
}
