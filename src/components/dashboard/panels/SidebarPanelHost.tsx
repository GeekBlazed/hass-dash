import { useDashboardStore } from '../../../stores/useDashboardStore';
import { AgendaPanel } from './AgendaPanel';
import { ClimatePanel } from './ClimatePanel';
import { LightingPanel } from './LightingPanel';
import { MediaPanel } from './MediaPanel';

export function SidebarPanelHost() {
  const activePanel = useDashboardStore((state) => state.activePanel);

  return (
    <>
      <AgendaPanel isHidden={activePanel !== 'agenda'} />
      <LightingPanel isHidden={activePanel !== 'lighting'} />
      <MediaPanel isHidden={activePanel !== 'media'} />
      <ClimatePanel isHidden={activePanel !== 'climate'} />
    </>
  );
}
