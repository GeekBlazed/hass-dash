import { useEffect, useMemo, useRef, useState } from 'react';

import { getDefaultFloor } from '../../../features/model/floorplan';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import {
  clampScale,
  computeBaseViewBoxFromFloor,
  flipYFromBaseViewBox,
  viewBoxToString,
  type ViewBox,
} from './floorplanViewBox';

const centroid = (points: Array<[number, number]>): [number, number] => {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
};

export function FloorplanSvg() {
  const floorplanModel = useDashboardStore((s) => s.floorplan.model);
  const stageView = useDashboardStore((s) => s.stageView);
  const setStageView = useDashboardStore((s) => s.setStageView);

  const floor = useMemo(() => {
    if (!floorplanModel) return undefined;
    return getDefaultFloor(floorplanModel);
  }, [floorplanModel]);

  const baseViewBox = useMemo(() => {
    if (!floor) return null;
    return computeBaseViewBoxFromFloor(floor);
  }, [floor]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const stageViewRef = useRef(stageView);
  const baseViewBoxRef = useRef<ViewBox | null>(null);
  const suppressRoomClickRef = useRef(false);

  useEffect(() => {
    stageViewRef.current = stageView;
  }, [stageView]);

  useEffect(() => {
    baseViewBoxRef.current = baseViewBox;
  }, [baseViewBox]);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [unitsPerPx, setUnitsPerPx] = useState<number | null>(null);
  const didInitStageRef = useRef(false);

  useEffect(() => {
    if (!floor || !baseViewBox) return;
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
  }, [baseViewBox, floor, setStageView, stageView.scale, stageView.x, stageView.y]);

  const computedViewBox = useMemo(() => {
    if (!baseViewBox) return null;
    const scale = clampScale(stageView.scale);
    return {
      x: stageView.x,
      y: stageView.y,
      w: baseViewBox.w / scale,
      h: baseViewBox.h / scale,
    };
  }, [baseViewBox, stageView.scale, stageView.x, stageView.y]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!computedViewBox) return;

    const applySizes = () => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;

      const nextUnitsPerPx = computedViewBox.w / rect.width;
      setUnitsPerPx((prev) => {
        if (prev === null) return nextUnitsPerPx;
        return Math.abs(prev - nextUnitsPerPx) < 1e-9 ? prev : nextUnitsPerPx;
      });
      const roomFontSize = 14 * nextUnitsPerPx;
      const roomClimateFontSize = 11 * nextUnitsPerPx;
      const nodeFontSize = 11 * nextUnitsPerPx;
      const nodeRadius = 4 * nextUnitsPerPx;
      const nodeLabelDx = 6 * nextUnitsPerPx;

      for (const el of svg.querySelectorAll('.room-label')) {
        if (el instanceof SVGTextElement) el.setAttribute('font-size', String(roomFontSize));
      }

      for (const el of svg.querySelectorAll('.room-climate')) {
        if (el instanceof SVGTextElement) el.setAttribute('font-size', String(roomClimateFontSize));
      }

      for (const el of svg.querySelectorAll('.node-label')) {
        if (el instanceof SVGTextElement) {
          el.setAttribute('font-size', String(nodeFontSize));
          el.setAttribute('dx', String(nodeLabelDx));
        }
      }

      for (const el of svg.querySelectorAll('.node-dot')) {
        if (el instanceof SVGCircleElement) {
          el.setAttribute('r', String(nodeRadius));
        }
      }
    };

    applySizes();

    const ro = new ResizeObserver(() => {
      applySizes();
    });
    ro.observe(svg);

    return () => {
      ro.disconnect();
    };
  }, [computedViewBox]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const pointers = new Map<number, { x: number; y: number; type: string }>();
    let mouseDragging = false;
    let dragStart: { x: number; y: number } | null = null;
    let dragMoved = false;
    let gestureStart: {
      startViewBox: { x: number; y: number; w: number; h: number };
      startScale: number;
      startMid: { x: number; y: number };
      startDist: number;
      startMidSvg: { x: number; y: number };
    } | null = null;

    const getCurrentViewBox = (): { x: number; y: number; w: number; h: number } | null => {
      const base = baseViewBoxRef.current;
      if (!base) return null;
      const nextScale = clampScale(stageViewRef.current.scale);
      return {
        x: stageViewRef.current.x,
        y: stageViewRef.current.y,
        w: base.w / nextScale,
        h: base.h / nextScale,
      };
    };

    const clientToSvg = (clientX: number, clientY: number): { x: number; y: number } => {
      const vb = getCurrentViewBox();
      const rect = svg.getBoundingClientRect();
      if (!vb || !rect.width || !rect.height) return { x: 0, y: 0 };
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      return {
        x: vb.x + px * vb.w,
        y: vb.y + py * vb.h,
      };
    };

    const viewBoxForScaleAround = (
      startVb: { x: number; y: number; w: number; h: number },
      nextScale: number,
      focalSvg: { x: number; y: number }
    ): { x: number; y: number; w: number; h: number } | null => {
      const base = baseViewBoxRef.current;
      if (!base) return null;

      const newW = base.w / nextScale;
      const newH = base.h / nextScale;
      const fx = focalSvg.x;
      const fy = focalSvg.y;
      const newX = fx - ((fx - startVb.x) * newW) / startVb.w;
      const newY = fy - ((fy - startVb.y) * newH) / startVb.h;
      return { x: newX, y: newY, w: newW, h: newH };
    };

    const setScaleAround = (nextScale: number, focalSvg: { x: number; y: number }) => {
      const vb = getCurrentViewBox();
      if (!vb) return;
      const clamped = clampScale(nextScale);
      const next = viewBoxForScaleAround(vb, clamped, focalSvg);
      if (!next) return;
      setStageView({ x: next.x, y: next.y, scale: clamped });
    };

    const panByPixels = (dxPx: number, dyPx: number) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const vb = getCurrentViewBox();
      if (!vb) return;
      const dx = (dxPx * vb.w) / rect.width;
      const dy = (dyPx * vb.h) / rect.height;
      setStageView({ x: vb.x - dx, y: vb.y - dy, scale: stageViewRef.current.scale });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const focal = clientToSvg(e.clientX, e.clientY);
      const zoomFactor = Math.pow(1.0016, -e.deltaY);
      const nextScale = clampScale(stageViewRef.current.scale * zoomFactor);
      setScaleAround(nextScale, focal);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Avoid pointer capture for interactive overlay elements.
      if (e.target instanceof Element) {
        const interactive = e.target.closest('.light-toggle');
        if (interactive) return;
      }

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      if (e.pointerType === 'mouse' && e.button === 0) {
        mouseDragging = false;
        dragMoved = false;
        dragStart = { x: e.clientX, y: e.clientY };
      }

      if (e.pointerType !== 'mouse' && pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const a = pts[0];
        const b = pts[1];
        const startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const startDist = Math.hypot(a.x - b.x, a.y - b.y);
        const startVb = getCurrentViewBox();
        if (!startVb) return;

        gestureStart = {
          startViewBox: startVb,
          startScale: stageViewRef.current.scale,
          startMid,
          startDist,
          startMidSvg: clientToSvg(startMid.x, startMid.y),
        };

        svg.classList.add('is-panning');
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });

      if (e.pointerType === 'mouse') {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;

        if (dragStart) {
          const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
          if (!mouseDragging && moved > 4) {
            mouseDragging = true;
            dragMoved = true;
            svg.classList.add('is-panning');
            try {
              svg.setPointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }
        }

        if (mouseDragging) {
          panByPixels(dx, dy);
          e.preventDefault();
          return;
        }
      }

      if (e.pointerType !== 'mouse' && pointers.size === 2 && gestureStart) {
        const pts = Array.from(pointers.values());
        const a = pts[0];
        const b = pts[1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        const zoomFactor = gestureStart.startDist > 0 ? dist / gestureStart.startDist : 1;
        const nextScale = clampScale(gestureStart.startScale * zoomFactor);
        const vb1 = viewBoxForScaleAround(
          gestureStart.startViewBox,
          nextScale,
          gestureStart.startMidSvg
        );
        if (!vb1) return;

        // Two-finger pan based on midpoint movement.
        const rect = svg.getBoundingClientRect();
        if (rect.width && rect.height) {
          const dxPx = mid.x - gestureStart.startMid.x;
          const dyPx = mid.y - gestureStart.startMid.y;
          vb1.x -= (dxPx * vb1.w) / rect.width;
          vb1.y -= (dyPx * vb1.h) / rect.height;
        }

        setStageView({ x: vb1.x, y: vb1.y, scale: nextScale });
        e.preventDefault();
      }
    };

    const endPointer = (e: PointerEvent) => {
      const wasMouse = e.pointerType === 'mouse';
      pointers.delete(e.pointerId);

      if (wasMouse) {
        mouseDragging = false;
        svg.classList.remove('is-panning');
        if (dragMoved) {
          suppressRoomClickRef.current = true;
          setTimeout(() => {
            suppressRoomClickRef.current = false;
          }, 0);
        }
        dragStart = null;
        dragMoved = false;
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (pointers.size < 2) {
        gestureStart = null;
        svg.classList.remove('is-panning');
        suppressRoomClickRef.current = true;
        setTimeout(() => {
          suppressRoomClickRef.current = false;
        }, 0);
      }
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);

    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endPointer);
      svg.removeEventListener('pointercancel', endPointer);
    };
  }, [setStageView]);

  const flipY = useMemo(() => {
    if (!baseViewBox) return null;
    return flipYFromBaseViewBox(baseViewBox);
  }, [baseViewBox]);

  const roomsForRender = useMemo(() => {
    if (!floor || !flipY) return [];
    return floor.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      points: room.points.map(([x, y]) => [x, flipY(y)] as [number, number]),
    }));
  }, [flipY, floor]);

  const nodesForRender = useMemo(() => {
    if (!floorplanModel || !flipY) return [];
    const nodes = floorplanModel.nodes ?? [];
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      x: n.point[0],
      y: flipY(n.point[1]),
    }));
  }, [flipY, floorplanModel]);

  const svgViewBox = computedViewBox ? viewBoxToString(computedViewBox) : '0 0 10 10';
  const baseViewBoxAttr = baseViewBox ? viewBoxToString(baseViewBox) : undefined;

  return (
    <svg
      id="floorplan-svg"
      ref={svgRef}
      viewBox={svgViewBox}
      data-base-viewbox={baseViewBoxAttr}
      role="img"
      aria-label="Home floorplan (from YAML)"
      style={{ touchAction: 'none' }}
    >
      <defs>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.12  0 1 0 0 0.08  0 0 1 0 0  0 0 0 1 0"
            result="tint"
          />
          <feMerge>
            <feMergeNode in="tint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter
          id="roomInnerGlow"
          x="-5%"
          y="-5%"
          width="95%"
          height="95%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feComposite in="blur" in2="SourceAlpha" operator="in" result="innerBlur" />
          <feFlood floodColor="#ffb65c" floodOpacity="0.28" result="glowColor" />
          <feComposite in="glowColor" in2="innerBlur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>

        <linearGradient id="floorWood" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255, 182, 92, 0.08)" />
          <stop offset="1" stopColor="rgba(0, 0, 0, 0)" />
        </linearGradient>

        <symbol id="devicePin" viewBox="0 0 64 64">
          <path
            d="M32 3C20.4 3 11 12.4 11 24c0 15.7 17.5 32.7 20.1 35.2.5.5 1.2.8 1.9.8s1.4-.3 1.9-.8C35.5 56.7 53 39.7 53 24 53 12.4 43.6 3 32 3z"
            fill="currentColor"
          />
          <circle cx="32" cy="24" r="16" fill="var(--text-primary)" fillOpacity="0.96" />
          <circle
            cx="32"
            cy="24"
            r="16"
            fill="none"
            stroke="var(--panel-bg)"
            strokeOpacity="0.2"
            strokeWidth="1.2"
          />
        </symbol>

        <symbol id="lightBulb" viewBox="0 0 24 24">
          <path
            d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-20C8.13 1 5 4.13 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26C17.81 12.47 19 10.38 19 8c0-3.87-3.13-7-7-7z"
            fill="currentColor"
          />
        </symbol>
      </defs>
      <g id="walls-layer">
        {roomsForRender.map((room) => {
          const pts = room.points.map(([x, y]) => `${x},${y}`).join(' ');
          const isActive = activeRoomId === room.id;

          return (
            <g
              key={room.id}
              className={`room${isActive ? 'is-active' : ''}`}
              data-room-id={room.id}
              tabIndex={0}
              role="button"
              aria-label={room.name}
              onClick={(e) => {
                if (suppressRoomClickRef.current) {
                  suppressRoomClickRef.current = false;
                  return;
                }
                e.preventDefault();
                setActiveRoomId(room.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveRoomId(room.id);
                }
              }}
            >
              <polygon points={pts} className="room-shape" />
            </g>
          );
        })}
      </g>
      <g id="labels-layer">
        {roomsForRender.map((room) => {
          const [cx, cy] = centroid(room.points);
          const isActive = activeRoomId === room.id;

          return (
            <g
              key={room.id}
              className={`room-label-group${isActive ? 'is-active' : ''}`}
              data-room-id={room.id}
            >
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="room-label"
              >
                {room.name}
              </text>
            </g>
          );
        })}
      </g>
      <g id="lights-layer"></g>
      <g id="nodes-layer">
        {nodesForRender.map((node) => (
          <g key={node.id} className="node" data-node-id={node.id}>
            <circle
              className="node-dot"
              cx={node.x}
              cy={node.y}
              r={unitsPerPx ? 4 * unitsPerPx : 0.12}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="start"
              dominantBaseline="middle"
              dx={unitsPerPx ? 6 * unitsPerPx : 0.2}
              className="node-label"
            >
              {node.name}
            </text>
          </g>
        ))}
      </g>
      <g id="devices-layer"></g>
    </svg>
  );
}
