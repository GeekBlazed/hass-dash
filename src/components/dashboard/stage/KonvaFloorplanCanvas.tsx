import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';

import { getDefaultFloor } from '../../../features/model/floorplan';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { clampScale, computeBaseViewBoxFromFloor, flipYFromBaseViewBox } from './floorplanViewBox';
import { centroid, flattenPoints, flipPointsY } from './konvaFloorplanRooms';
import {
  computeKonvaStageScalePxPerUnit,
  panStageViewByPixels,
  zoomStageViewAroundPointer,
} from './konvaStageMath';

const isTextInputLike = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

export default function KonvaFloorplanCanvas() {
  const floorplanModel = useDashboardStore((s) => s.floorplan.model);
  const stageView = useDashboardStore((s) => s.stageView);
  const setStageView = useDashboardStore((s) => s.setStageView);
  const resetStageView = useDashboardStore((s) => s.resetStageView);

  const didInitStageRef = useRef(false);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  const floor = useMemo(() => {
    if (!floorplanModel) return undefined;
    return getDefaultFloor(floorplanModel);
  }, [floorplanModel]);

  const baseViewBox = useMemo(() => {
    if (!floor) return { x: 0, y: 0, w: 10, h: 10 };
    return computeBaseViewBoxFromFloor(floor);
  }, [floor]);

  const flipY = useMemo(() => {
    return flipYFromBaseViewBox(baseViewBox);
  }, [baseViewBox]);

  useEffect(() => {
    if (!floor) return;
    if (didInitStageRef.current) return;

    const isDefaultStage = stageView.x === 0 && stageView.y === 0 && stageView.scale === 1;
    if (!isDefaultStage) {
      didInitStageRef.current = true;
      return;
    }

    const initialScale = clampScale(Number(floor.initialView?.scale ?? 1));
    const initialW = baseViewBox.w / initialScale;
    const initialH = baseViewBox.h / initialScale;

    const centeredX = baseViewBox.x + (baseViewBox.w - initialW) / 2;
    const centeredY = baseViewBox.y + (baseViewBox.h - initialH) / 2;

    const yamlX = Number(floor.initialView?.x);
    const yamlY = Number(floor.initialView?.y);

    const x = Number.isFinite(yamlX) ? yamlX : centeredX;
    const y = Number.isFinite(yamlY) ? yamlY : centeredY;

    setStageView({ x, y, scale: initialScale });
    didInitStageRef.current = true;
  }, [baseViewBox.h, baseViewBox.w, baseViewBox.x, baseViewBox.y, floor, setStageView, stageView]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewport((prev) => {
        const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
        if (prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, []);

  const clampedScale = clampScale(stageView.scale);
  const stageScale = computeKonvaStageScalePxPerUnit(
    { w: baseViewBox.w },
    { width: viewport.width },
    clampedScale
  );

  const stageX = -stageView.x * stageScale;
  const stageY = -stageView.y * stageScale;

  const isReady = viewport.width > 0 && viewport.height > 0;

  const roomsForRender = useMemo(() => {
    if (!floor) return [];
    return floor.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      points: flipPointsY(room.points, flipY),
    }));
  }, [floor, flipY]);

  const draggingRef = useRef<{
    startClientX: number;
    startClientY: number;
    startViewX: number;
    startViewY: number;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInputLike(e.target)) return;

      const stepPx = e.shiftKey ? 120 : 60;

      if (e.key === '0') {
        e.preventDefault();
        resetStageView();
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const nextScale = clampScale(clampedScale * 1.1);
        const pointerPx = { x: viewport.width / 2, y: viewport.height / 2 };
        const next = zoomStageViewAroundPointer(
          { w: baseViewBox.w },
          { width: viewport.width },
          { ...stageView, scale: clampedScale },
          pointerPx,
          nextScale
        );
        setStageView(next);
        return;
      }

      if (e.key === '-') {
        e.preventDefault();
        const nextScale = clampScale(clampedScale / 1.1);
        const pointerPx = { x: viewport.width / 2, y: viewport.height / 2 };
        const next = zoomStageViewAroundPointer(
          { w: baseViewBox.w },
          { width: viewport.width },
          { ...stageView, scale: clampedScale },
          pointerPx,
          nextScale
        );
        setStageView(next);
        return;
      }

      const pan = (dxPx: number, dyPx: number) => {
        const next = panStageViewByPixels(
          { w: baseViewBox.w },
          { width: viewport.width },
          { ...stageView, scale: clampedScale },
          dxPx,
          dyPx
        );
        setStageView(next);
      };

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          pan(-stepPx, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          pan(stepPx, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          pan(0, -stepPx);
          break;
        case 'ArrowDown':
          e.preventDefault();
          pan(0, stepPx);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    baseViewBox.w,
    clampedScale,
    resetStageView,
    setStageView,
    stageView,
    viewport.height,
    viewport.width,
  ]);

  if (!isReady) {
    return <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }} />;
  }

  return (
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }}>
      <Stage
        width={viewport.width}
        height={viewport.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stageX}
        y={stageY}
        onWheel={(e) => {
          e.evt.preventDefault();

          const stage = e.target.getStage();
          const pos = stage?.getPointerPosition();
          if (!pos) return;

          const zoomFactor = Math.pow(1.0016, -e.evt.deltaY);
          const nextScale = clampScale(clampedScale * zoomFactor);

          const next = zoomStageViewAroundPointer(
            { w: baseViewBox.w },
            { width: viewport.width },
            { ...stageView, scale: clampedScale },
            { x: pos.x, y: pos.y },
            nextScale
          );

          setStageView(next);
        }}
        onMouseDown={(e) => {
          if (e.evt.button !== 0) return;
          draggingRef.current = {
            startClientX: e.evt.clientX,
            startClientY: e.evt.clientY,
            startViewX: stageView.x,
            startViewY: stageView.y,
          };
        }}
        onMouseMove={(e) => {
          const dragging = draggingRef.current;
          if (!dragging) return;

          const dxPx = e.evt.clientX - dragging.startClientX;
          const dyPx = e.evt.clientY - dragging.startClientY;

          const next = panStageViewByPixels(
            { w: baseViewBox.w },
            { width: viewport.width },
            { x: dragging.startViewX, y: dragging.startViewY, scale: clampedScale },
            dxPx,
            dyPx
          );

          setStageView(next);
        }}
        onMouseUp={() => {
          draggingRef.current = null;
        }}
        onMouseLeave={() => {
          draggingRef.current = null;
        }}
        style={{ background: 'transparent' }}
      >
        <Layer>
          <Rect
            x={baseViewBox.x}
            y={baseViewBox.y}
            width={baseViewBox.w}
            height={baseViewBox.h}
            fill="#0b0b0b"
            stroke="rgba(255, 255, 255, 0.10)"
            strokeWidth={0.1}
          />

          {roomsForRender.map((room) => {
            const isHovered = hoveredRoomId === room.id;
            const [cx, cy] = centroid(room.points);

            return (
              <Group key={room.id}>
                <Line
                  points={flattenPoints(room.points)}
                  closed
                  fill={isHovered ? '#1a1713' : '#121212'}
                  stroke={isHovered ? '#ffc97d' : 'rgba(255, 255, 255, 0.10)'}
                  strokeWidth={0.12}
                  onMouseEnter={() => setHoveredRoomId(room.id)}
                  onMouseLeave={() => setHoveredRoomId((prev) => (prev === room.id ? null : prev))}
                  onClick={() => {
                    // Iteration 3.3: click handler is log-only for now.
                    console.log('Room clicked', room.id, room.name);
                  }}
                />
                <Text
                  x={cx}
                  y={cy}
                  text={room.name}
                  fill="rgba(255, 255, 255, 0.82)"
                  fontSize={0.7}
                  offsetX={room.name.length * 0.2}
                  offsetY={0.35}
                  listening={false}
                />
              </Group>
            );
          })}

          <Text
            x={baseViewBox.x + 0.5}
            y={baseViewBox.y + 0.5}
            text="Konva canvas (dev: ?konva=1)\nDrag to pan, wheel to zoom"
            fill="rgba(255, 255, 255, 0.6)"
            fontSize={0.6}
            listening={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}
