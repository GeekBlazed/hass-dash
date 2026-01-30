import { useCallback, useEffect } from 'react';

import { ROOM_ZOOM_TRANSITION_MS, useDashboardStore } from '../../../stores/useDashboardStore';
import { FloorplanSvg } from './FloorplanSvg';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export function RoomZoomCanvas() {
  const roomZoomMode = useDashboardStore((s) => s.roomZoom.mode);
  const finishEnterRoomZoom = useDashboardStore((s) => s.finishEnterRoomZoom);
  const startExitRoomZoom = useDashboardStore((s) => s.startExitRoomZoom);
  const finishExitRoomZoom = useDashboardStore((s) => s.finishExitRoomZoom);
  const setRoomZoomStageView = useDashboardStore((s) => s.setRoomZoomStageView);

  // Animate camera transitions (viewBox updates) during enter/exit.
  useEffect(() => {
    if (roomZoomMode !== 'entering' && roomZoomMode !== 'exiting') return;

    const { stageView: from, targetStageView: to } = useDashboardStore.getState().roomZoom;
    if (!from || !to) return;

    let rafId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const rawT = (now - startedAt) / ROOM_ZOOM_TRANSITION_MS;
      const clampedT = Math.min(1, Math.max(0, rawT));
      const t = easeInOutCubic(clampedT);

      setRoomZoomStageView({
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        scale: lerp(from.scale, to.scale, t),
      });

      if (clampedT < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [roomZoomMode, setRoomZoomStageView]);

  useEffect(() => {
    if (roomZoomMode === 'entering') {
      const timerId = window.setTimeout(() => {
        finishEnterRoomZoom();
      }, ROOM_ZOOM_TRANSITION_MS);
      return () => {
        window.clearTimeout(timerId);
      };
    }

    if (roomZoomMode === 'exiting') {
      const timerId = window.setTimeout(() => {
        finishExitRoomZoom();
      }, ROOM_ZOOM_TRANSITION_MS);
      return () => {
        window.clearTimeout(timerId);
      };
    }

    return;
  }, [finishEnterRoomZoom, finishExitRoomZoom, roomZoomMode]);

  const onExit = useCallback(() => {
    startExitRoomZoom();
  }, [startExitRoomZoom]);

  return (
    <div
      className={`room-zoom${roomZoomMode === 'entering' ? 'room-zoom--entering' : ''}${
        roomZoomMode === 'room' ? 'room-zoom--room' : ''
      }${roomZoomMode === 'exiting' ? 'room-zoom--exiting' : ''}`}
      data-testid="room-zoom"
      data-room-zoom-mode={roomZoomMode}
    >
      <FloorplanSvg roomScope="active" />

      <button
        className="room-zoom__minimap"
        type="button"
        aria-label="Exit room view"
        onClick={onExit}
        onPointerDown={(e) => {
          // Prevent underlying SVG panning.
          e.stopPropagation();
        }}
      >
        <div className="room-zoom__minimap-inner" aria-hidden="true">
          <FloorplanSvg
            idPrefix="minimap"
            viewMode="base"
            interactive={false}
            roomScope="all"
            renderRoomLabels={false}
            renderNodes={false}
          />
        </div>
      </button>
    </div>
  );
}
