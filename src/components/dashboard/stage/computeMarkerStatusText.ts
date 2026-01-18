import { getTrackingShowConfidenceWhenLessThan } from '../../../features/tracking/trackingShowConfidenceConfig';
import type { DeviceLocation } from '../../../stores/useDeviceLocationStore';

export const computeMarkerStatusText = (
  location: DeviceLocation,
  isStale: boolean,
  ageMinutes: number | null
): string | null => {
  if (isStale && ageMinutes && ageMinutes > 0) {
    return `> ${ageMinutes} minutes`;
  }

  const confidence = location.confidence;
  if (!Number.isFinite(confidence)) return null;

  const threshold = getTrackingShowConfidenceWhenLessThan();
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;
  if (confidence >= threshold) return null;

  return `${Math.round(confidence)}%`;
};
