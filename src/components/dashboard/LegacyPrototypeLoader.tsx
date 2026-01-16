import { useEffect } from 'react';

import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const LEGACY_SCRIPT_ID = 'hass-dash-legacy-prototype-script';

const loadLegacyPrototypeScript = (): void => {
  if (typeof document === 'undefined') return;

  // Avoid loading in unit tests.
  if (import.meta.env.VITEST) return;

  if (document.getElementById(LEGACY_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = LEGACY_SCRIPT_ID;
  script.src = '/scripts.js';
  script.defer = true;

  document.head.appendChild(script);
};

/**
 * Conditionally loads the legacy prototype runtime (`public/scripts.js`).
 *
 * - Flag OFF (default): legacy runtime is loaded and continues to own SVG rendering/pan/zoom.
 * - Flag ON: legacy runtime is not loaded; React renderer owns the SVG.
 */
export function LegacyPrototypeLoader() {
  const { isEnabled: reactRendererEnabled } = useFeatureFlag('REACT_FLOORPLAN_RENDERER');

  useEffect(() => {
    if (!reactRendererEnabled) {
      loadLegacyPrototypeScript();
    }
  }, [reactRendererEnabled]);

  return null;
}
