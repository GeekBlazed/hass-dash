const DEFAULT_STALE_WARNING_MINUTES = 10;

const stripInlineComment = (value: string): string => {
  // Vite's dotenv parsing may include inline comments in the value,
  // e.g. `10 # minutes`. Treat everything after `#` or `;`
  // as comment text.
  const hashIndex = value.indexOf('#');
  const semiIndex = value.indexOf(';');
  const cutIndex =
    hashIndex === -1 ? semiIndex : semiIndex === -1 ? hashIndex : Math.min(hashIndex, semiIndex);
  return (cutIndex === -1 ? value : value.slice(0, cutIndex)).trim();
};

const parseMinutes = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = stripInlineComment(value);
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed <= 0) return undefined;
  return parsed;
};

export const getTrackingStaleWarningMs = (): number => {
  const raw = import.meta.env.VITE_TRACKING_STALE_WARNING_MINUTES;
  const minutes = parseMinutes(raw) ?? DEFAULT_STALE_WARNING_MINUTES;
  return minutes * 60_000;
};
