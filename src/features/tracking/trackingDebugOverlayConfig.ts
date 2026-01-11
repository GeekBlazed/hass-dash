export type TrackingDebugOverlayMode = 'xyz' | 'geo';

const DEFAULT_MODE: TrackingDebugOverlayMode = 'xyz';

const stripInlineComment = (value: string): string => {
  // Vite's dotenv parsing may include inline comments in the value,
  // e.g. `geo # Allowed: xyz | geo`. Treat everything after `#` or `;`
  // as comment text.
  const hashIndex = value.indexOf('#');
  const semiIndex = value.indexOf(';');
  const cutIndex =
    hashIndex === -1 ? semiIndex : semiIndex === -1 ? hashIndex : Math.min(hashIndex, semiIndex);
  return (cutIndex === -1 ? value : value.slice(0, cutIndex)).trim();
};

const parseMode = (value: unknown): TrackingDebugOverlayMode | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = stripInlineComment(value).toLowerCase();
  if (trimmed === 'xyz') return 'xyz';
  if (trimmed === 'geo') return 'geo';
  return undefined;
};

export const getTrackingDebugOverlayMode = (): TrackingDebugOverlayMode => {
  const raw = import.meta.env.VITE_TRACKING_DEBUG_OVERLAY_MODE;
  return parseMode(raw) ?? DEFAULT_MODE;
};
