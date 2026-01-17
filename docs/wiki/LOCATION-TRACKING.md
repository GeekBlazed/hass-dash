# Location Tracking (Wiki)

This page explains how **location tracking** works in hass-dash from a user/operator perspective.

Location tracking shows the live position of people/devices on the floorplan by consuming coordinates produced by ESPresense (typically via Home Assistant `device_tracker.*` entities).

## What you get

- Live markers on the floorplan (e.g., phones, wearables).
- Optional dev-only debug overlay showing raw values (coordinates, confidence, last-seen).
- Guardrails to reduce jitter/noise (confidence threshold, throttling, staleness handling).

## Requirements

### Home Assistant + ESPresense

This app expects ESPresense location data to appear in Home Assistant as entities (commonly `device_tracker.*`) with ESPresense-companion-style attributes.

Minimum required attributes per tracked entity:

- `x` (number)
- `y` (number)
- `confidence` (number)

Optional attributes (recommended):

- `z` (number)
- `last_seen` (ISO timestamp string)
- GPS fields (varies by setup): `latitude`, `longitude`, `elevation`

### Feature flags

Location tracking is behind feature flags.

- `VITE_FEATURE_DEVICE_TRACKING=true`
- `VITE_FEATURE_HA_CONNECTION=true`

If `DEVICE_TRACKING=true` but Home Assistant connectivity is disabled, tracking will not start.

## Configuration

### Confidence threshold

- `VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE`
  - Default: `69`
  - Rule: a location update is accepted only when `confidence > minConfidence` (strict `>`).

### Staleness behavior

These settings control how long markers remain visible without new updates:

- `VITE_TRACKING_STALE_WARNING_MINUTES` (default `10`)
  - When a device is older than this, keep it visible but render it as stale.
- `VITE_TRACKING_STALE_TIMEOUT_MINUTES` (default `30`)
  - When a device is older than this, hide it.

### Debug overlay (dev-only)

- `VITE_FEATURE_TRACKING_DEBUG_OVERLAY=true`
- `VITE_TRACKING_DEBUG_OVERLAY_MODE=xyz | geo`

The debug overlay is intentionally disabled in production builds even if enabled in `.env`.

## Coordinate system (important)

- ESPresense coordinates are treated as **meters**.
- ESPresense `y` commonly increases “up” (north/up), while SVG `y` increases downward.
- The floorplan renderer may flip Y within the SVG viewBox so markers align visually.

If markers appear mirrored vertically, confirm:

- Your floorplan SVG viewBox is correct.
- Your ESPresense origin and axis direction match the app’s assumed mapping.

## Troubleshooting

### Tracking is enabled but nothing moves

1. Confirm flags are enabled:
   - `VITE_FEATURE_DEVICE_TRACKING=true`
   - `VITE_FEATURE_HA_CONNECTION=true`
2. Confirm Home Assistant is connected (WebSocket connected in the app).
3. In Home Assistant Developer Tools → States, inspect your `device_tracker.*` entity:
   - Ensure it has `attributes.x`, `attributes.y`, `attributes.confidence`.
4. Check the confidence gate:
   - Updates with `confidence <= VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE` are ignored.

### Markers appear but are offset / mirrored

- Verify the floorplan SVG viewBox and scale.
- Verify ESPresense node/device coordinates are in the same coordinate system as the floorplan.
- If your ESPresense coordinate system is different (rotated axes, different origin), you’ll need a mapping/calibration step (not yet built into the app).

### Debug overlay is enabled but you don’t see labels

- Debug overlay is dev-only; production builds intentionally disable it.
- Ensure `VITE_FEATURE_TRACKING_DEBUG_OVERLAY=true` and choose a mode:
  - `VITE_TRACKING_DEBUG_OVERLAY_MODE=xyz` or `geo`

## Privacy & safety notes

Location tracking is sensitive.

- Avoid exposing your Home Assistant instance publicly.
- Treat device locations as personal data.
- Prefer limiting who can access hass-dash and Home Assistant.

## For developers

If you’re implementing or extending the ESPresense integration (transport options, smoothing, multi-floor), see:

- `docs/feature-requests/ESPRESENSE-INTEGRATION.md`
