# Device / Person Tracking (Wiki)

This page documents how **device tracking** currently works in hass-dash (Phase 1: ESPresense device location via Home Assistant entities). It is intentionally implementation-specific: it names the concrete services, methods, call chains, and configuration keys used by the running app.

> Related design doc: `docs/FEATURE-DEVICE-TRACKING-ESPRESENSE.md` (long-form rationale + upstream ESPresense notes).

---

## Overview (What Happens at Runtime)

At a high level, the application:

1. **Subscribes to Home Assistant `state_changed` events** via `IEntityService.subscribeToStateChanges()`.
2. **Filters and normalizes** ESPresense-companion-style attributes (`x`, `y`, optional `z`, `confidence`, `last_seen`, optional GPS fields).
3. **Stores the latest accepted update per entity** in the Zustand store `useDeviceLocationStore`.
4. **Mirrors those stored locations onto the floorplan SVG** by creating/updating markers in the `devices-layer` group.

---

## End-to-End Call Chain

### Mount → subscription

The tracking pipeline is started by a non-visual controller component:

- `src/components/dashboard/DeviceLocationTrackingController.tsx`
  - React `useEffect()` checks feature flags and then:
    - `new DeviceLocationTrackingService(entityService, storeSink)`
    - `await service.start()`
    - On unmount: `await service.stop()`

The entity service instance is DI-resolved by default:

- `src/core/di-container.ts`
  - `container.bind<IEntityService>(TYPES.IEntityService).to(HomeAssistantEntityService)`

### HA events → entity state

The Home Assistant-backed entity service is:

- `src/services/HomeAssistantEntityService.ts`
  - `subscribeToStateChanges(handler)` ensures HA client is connected:
    - `if (!this.haClient.isConnected()) await this.haClient.connect()`
  - Subscribes to HA events:
    - `this.haClient.subscribeToEvents<HaStateChangedEventData>('state_changed', ...)`
  - Extracts `event.data.new_state` and calls the provided handler with that `HaEntityState`.

### Entity state → location updates

The tracking service logic is:

- `src/services/DeviceLocationTrackingService.ts`
  - `start()`
    - Calls `entityService.subscribeToStateChanges((next) => this.handleEntityState(next))`
  - `handleEntityState(next: HaEntityState)`
    - `extractDeviceLocationUpdateFromHaEntityState(next, this.minConfidence)`
    - For each update:
      - `if (!this.shouldAcceptUpdate(update)) continue`
      - `this.store.upsert(update.entityId, mapUpdateToDeviceLocation(update))`
  - Hardening gates:
    - `passesThrottle(update)` (per-entity fixed window)
    - `passesLastSeenGuard(update)` (optional stale guard)

The extractor is:

- `src/features/tracking/espresense/espresenseLocationExtractor.ts`
  - `extractDeviceLocationUpdateFromHaEntityState(entityState, minConfidence, receivedAt?)`
    - Reads `entityState.attributes` and expects:
      - `x`, `y` (required)
      - `z` (optional)
      - `confidence` (required)
      - `last_seen` (optional)
      - Geo fields are optional and best-effort
    - Enforces the confidence gate here as well:
      - accepts only when `confidence > minConfidence`

Note: there is also a JSON envelope parser for HA event payload samples:

- `extractDeviceLocationUpdatesFromJsonPayload(payload, minConfidence, receivedAt?)`

### Location store → SVG markers

The floorplan stage always includes the marker bridge:

- `src/components/dashboard/stage/FloorplanCanvas.tsx`
  - Renders `<TrackedDeviceMarkersBridge />` alongside `<FloorplanSvg />`

The marker bridge is:

- `src/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx`
  - Reads feature flags:
    - `useFeatureFlag('DEVICE_TRACKING')`
    - `useFeatureFlag('TRACKING_DEBUG_OVERLAY')`
  - Reads locations from the store:
    - `useDeviceLocationStore((s) => s.locationsByEntityId)`
  - On effect:
    - `syncMarkers(layer, isEnabled, locationsByEntityId, showDebugOverlay, debugMode)`
    - Installs a `MutationObserver` on the devices layer so markers are re-applied if the prototype renderer clears/rebuilds the layer.

---

## Data Model (What We Store)

The persisted store type is:

- `src/stores/useDeviceLocationStore.ts`
  - `DeviceLocation`
    - `position: { x: number; y: number; z?: number }`
    - `geo?: { latitude: number; longitude: number; elevation?: number }`
    - `confidence: number`
    - `lastSeen: string | undefined`
    - `receivedAt: number`

Storage details:

- `useDeviceLocationStore` is a Zustand store with:
  - `upsert(entityId, location)`
  - `clear()`
- It is persisted via `zustand/middleware/persist` under:
  - storage key: `hass-dash:device-locations`
  - `partialize` includes only `locationsByEntityId`

---

## Configuration & Feature Flags

### Core enablement

Tracking requires both of these feature flags enabled (because the transport is Home Assistant):

- `VITE_FEATURE_DEVICE_TRACKING=true`
- `VITE_FEATURE_HA_CONNECTION=true`

The controller will:

- warn in dev if `DEVICE_TRACKING=true` but `HA_CONNECTION=false`
- start only when both are enabled

### Confidence threshold

Minimum confidence threshold (strict >):

- `VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE`
  - read by: `getEspresenseMinConfidence()`
  - file: `src/features/tracking/espresense/espresenseTrackingConfig.ts`
  - default: `69`
  - behavior: accept only when `confidence > minConfidence`

---

## Coordinate System & Rendering Details

### Positioning

Markers are positioned by applying a translate transform to an SVG `<g>`:

- `marker.setAttribute('transform', `translate(${x} ${yRender})`)`

### Y-axis flipping

The bridge mirrors the original prototype coordinate system by flipping Y when possible:

- `flipYIfPossible(y)`
  - reads the SVG viewBox via `readViewBox()`
  - computes: `yRender = 2 * vb.y + vb.h - y`

This means:

- ESPresense `y` increases upward (north/up)
- SVG `y` increases downward
- The bridge flips within the current viewBox so markers align visually.

---

## Marker Binding Rules (How Entities Map to Markers)

The bridge tries to reuse existing markers rendered by the prototype layer when possible:

- Prefer an exact match using HA entity id (e.g. `device_tracker.phone_jeremy`).
- Fall back to matching the object_id portion (e.g. `phone_jeremy`) for legacy markers.

Implementation helpers:

- `getMarkerIdsForEntityId(entityId)`
- `getDeviceLabel(entityId)` (used as the on-marker label)

When tracking is disabled:

- If a marker was “bound” to a pre-existing prototype marker, it restores the original `transform` and removes tracking attributes.
- If a marker was “created” by the bridge, it is removed.

---

## Debug Overlay Rendering

When enabled (dev-only), the bridge appends a `<text>` element using multi-line `<tspan>` rows.

Key helpers:

- `formatDebugLabelLines(location, mode)`
  - `xyz` mode shows: `x/y/z`, `conf`, `last_seen`
  - `geo` mode shows: `lat/lon/(ele)`, `conf`, `last_seen`
- `formatNumberCompact(value)` uses `toFixed(2)` for compactness.

Geo mode caveat:

- `lat/lon` will show `-` if `location.geo` is missing.
- Geo data depends on upstream ESPresense / HA entity attributes being configured to publish GPS fields.

---

## Troubleshooting

### “Tracking is enabled but nothing moves”

Checklist:

1. Confirm both flags are enabled:
   - `VITE_FEATURE_DEVICE_TRACKING=true`
   - `VITE_FEATURE_HA_CONNECTION=true`
2. Confirm HA connection succeeds (WebSocket connected).
3. In Home Assistant Developer Tools → States, inspect the relevant `device_tracker.*` entity.
   - It must have `attributes.x`, `attributes.y`, and `attributes.confidence` for updates to be accepted.
4. Confirm confidence threshold:
   - if `confidence <= VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE` the update will be ignored.

### “Debug overlay shows geo mode but lat/lon are missing”

- Ensure ESPresense-companion is configured to publish GPS fields.
- The app accepts geo under several common key variants (direct and nested), but it cannot invent coordinates that are not present in HA entity attributes.

---

## Tests (Where Behavior is Locked In)

Useful tests to reference when changing behavior:

- `src/services/DeviceLocationTrackingService.test.ts`
  - confidence boundary behavior (`>`)
  - throttling behavior (`passesThrottle`)
  - last_seen stale guard behavior
- `src/features/tracking/espresense/espresenseLocationExtractor.test.ts`
  - parsing of x/y/z/confidence/last_seen
  - geo extraction variants
- `src/components/dashboard/stage/TrackedDeviceMarkersBridge.test.tsx`
  - marker creation/binding
  - coordinate flipping behavior
  - debug overlay rendering (xyz/geo)
