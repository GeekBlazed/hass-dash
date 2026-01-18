const stripInlineComment = (value: string): string => {
  // Vite's dotenv parsing may include inline comments in the value,
  // e.g. `90 # percent`. Treat everything after `#` or `;`
  // as comment text.
  const hashIndex = value.indexOf('#');
  const semiIndex = value.indexOf(';');
  const cutIndex =
    hashIndex === -1 ? semiIndex : semiIndex === -1 ? hashIndex : Math.min(hashIndex, semiIndex);
  return (cutIndex === -1 ? value : value.slice(0, cutIndex)).trim();
};

const parseThreshold = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = stripInlineComment(value);
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

/**
 * Returns the confidence threshold (in % points) below which the UI should show
 * a confidence label, or `undefined` when the label should be disabled.
 *
 * Default behavior: if the env var is NOT set at all, confidence labels are never shown.
 */
export const getTrackingShowConfidenceWhenLessThan = (): number | undefined => {
  const raw = import.meta.env.VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN;
  return parseThreshold(raw);
};
