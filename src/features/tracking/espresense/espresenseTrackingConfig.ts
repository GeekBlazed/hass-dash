const DEFAULT_MIN_CONFIDENCE = 69;

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const getEspresenseMinConfidence = (): number => {
  const raw = import.meta.env.VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE;
  const parsed = parseNumber(raw);
  return parsed ?? DEFAULT_MIN_CONFIDENCE;
};
