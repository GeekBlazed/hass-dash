import { lazy, Suspense } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';

const LazyAgendaPanel = lazy(() => import('./AgendaPanel').then((m) => ({ default: m.AgendaPanel })));
const LazyCamerasPanel = lazy(() =>
  import('./CamerasPanel').then((m) => ({ default: m.CamerasPanel }))
);
const LazyClimatePanel = lazy(() =>
  import('./ClimatePanel').then((m) => ({ default: m.ClimatePanel }))
);
const LazyLightingPanel = lazy(() =>
  import('./LightingPanel').then((m) => ({ default: m.LightingPanel }))
);
const LazyMediaPanel = lazy(() => import('./MediaPanel').then((m) => ({ default: m.MediaPanel })));

export function SidebarPanelHost() {
  const activePanel = useDashboardStore((state) => state.activePanel);

  return (
    <>
      {activePanel === 'agenda' ? (
        <Suspense fallback={<div id="agenda" className="agenda" aria-label="Agenda" />}>
          <LazyAgendaPanel isHidden={false} />
        </Suspense>
      ) : (
        <div id="agenda" className="agenda is-hidden" aria-label="Agenda" />
      )}

      {activePanel === 'lighting' ? (
        <Suspense
          fallback={
            <section
              id="lighting-panel"
              className="tile lighting-panel"
              aria-label="Lighting controls"
            />
          }
        >
          <LazyLightingPanel isHidden={false} />
        </Suspense>
      ) : (
        <section
          id="lighting-panel"
          className="tile lighting-panel is-hidden"
          aria-label="Lighting controls"
        />
      )}

      {activePanel === 'media' ? (
        <Suspense
          fallback={<section id="media-window" className="tile media-window" aria-label="Media player" />}
        >
          <LazyMediaPanel isHidden={false} />
        </Suspense>
      ) : (
        <section
          id="media-window"
          className="tile media-window is-hidden"
          aria-label="Media player"
        />
      )}

      {activePanel === 'climate' ? (
        <Suspense
          fallback={
            <section id="climate-panel" className="tile climate-panel" aria-label="Climate controls" />
          }
        >
          <LazyClimatePanel isHidden={false} />
        </Suspense>
      ) : (
        <section
          id="climate-panel"
          className="tile climate-panel is-hidden"
          aria-label="Climate controls"
        />
      )}

      {activePanel === 'cameras' ? (
        <Suspense
          fallback={
            <section id="cameras-panel" className="tile cameras-panel" aria-label="Cameras controls" />
          }
        >
          <LazyCamerasPanel isHidden={false} />
        </Suspense>
      ) : (
        <section
          id="cameras-panel"
          className="tile cameras-panel is-hidden"
          aria-label="Cameras controls"
        />
      )}
    </>
  );
}
