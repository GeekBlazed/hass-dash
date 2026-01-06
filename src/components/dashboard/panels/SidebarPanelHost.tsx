import { AgendaPanel } from './AgendaPanel';
import { ClimatePanel } from './ClimatePanel';
import { LightingPanel } from './LightingPanel';
import { MediaPanel } from './MediaPanel';

export function SidebarPanelHost() {
  return (
    <>
      <AgendaPanel />
      <LightingPanel />
      <MediaPanel />
      <ClimatePanel />
    </>
  );
}
