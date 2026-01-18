import type { StageView } from '../../../stores/useDashboardStore';

export interface BaseBounds {
  w: number;
}

export interface ViewportPx {
  width: number;
}

export interface PointerPx {
  x: number;
  y: number;
}

export function computeKonvaStageScalePxPerUnit(
  base: BaseBounds,
  viewport: ViewportPx,
  scale: number
): number {
  if (!Number.isFinite(base.w) || base.w <= 0) return 1;
  if (!Number.isFinite(viewport.width) || viewport.width <= 0) return 1;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return (viewport.width * scale) / base.w;
}

export function panStageViewByPixels(
  base: BaseBounds,
  viewport: ViewportPx,
  stageView: StageView,
  dxPx: number,
  dyPx: number
): StageView {
  const stageScale = computeKonvaStageScalePxPerUnit(base, viewport, stageView.scale);
  if (!Number.isFinite(stageScale) || stageScale <= 0) return stageView;

  const dxWorld = dxPx / stageScale;
  const dyWorld = dyPx / stageScale;

  return {
    x: stageView.x - dxWorld,
    y: stageView.y - dyWorld,
    scale: stageView.scale,
  };
}

export function zoomStageViewAroundPointer(
  base: BaseBounds,
  viewport: ViewportPx,
  stageView: StageView,
  pointerPx: PointerPx,
  nextScale: number
): StageView {
  const prevStageScale = computeKonvaStageScalePxPerUnit(base, viewport, stageView.scale);
  const nextStageScale = computeKonvaStageScalePxPerUnit(base, viewport, nextScale);

  if (prevStageScale <= 0 || nextStageScale <= 0) return stageView;

  const focalWorldX = stageView.x + pointerPx.x / prevStageScale;
  const focalWorldY = stageView.y + pointerPx.y / prevStageScale;

  const nextX = focalWorldX - pointerPx.x / nextStageScale;
  const nextY = focalWorldY - pointerPx.y / nextStageScale;

  return {
    x: nextX,
    y: nextY,
    scale: nextScale,
  };
}
