export type TrackingDebugOverlayMode = 'xyz' | 'geo';

const DEFAULT_MODE: TrackingDebugOverlayMode = 'xyz';

const parseMode = (value: unknown): TrackingDebugOverlayMode | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'xyz') return 'xyz';
  if (trimmed === 'geo') return 'geo';
  return undefined;
};

export const getTrackingDebugOverlayMode = (): TrackingDebugOverlayMode => {
  const raw = import.meta.env.VITE_TRACKING_DEBUG_OVERLAY_MODE;
  return parseMode(raw) ?? DEFAULT_MODE;
};
