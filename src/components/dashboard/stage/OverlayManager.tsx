import { OVERLAYS } from './overlayDefinitions';

export function OverlayManager({ renderer }: { renderer: 'svg' }) {
  return (
    <>
      {OVERLAYS.filter((o) => o.renderer === renderer).map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </>
  );
}
