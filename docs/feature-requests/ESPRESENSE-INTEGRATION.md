# Feature Request: ESPresense Integration (Location Tracking)

**Audience:** application developers and contributors.

This document defines requirements for ingesting ESPresense-derived location updates and rendering them on the hass-dash floorplan.

## 1. Problem statement

We want hass-dash to show live positions for people/devices/pets on a floorplan. ESPresense can provide high-frequency coordinates (`x`, `y`, optional `z`) plus quality signals (e.g., `confidence`, `fixes`, `last_seen`).

## 2. Current status (as of Jan 2026)

- Phase 1 tracking is implemented using **Home Assistant as the transport** (consume `device_tracker.*` entity updates via HA WebSocket `state_changed`).
- Markers are rendered on the floorplan SVG.
- Updates are gated by a configurable confidence threshold (`confidence > minConfidence`).

### 2.1 Completed (implemented)

The following deliverables are already implemented in the app:

- HA-mediated transport (Phase 1 default): subscribe to entity updates via `IEntityService.subscribeToStateChanges()`.
- Extraction + normalization: parse ESPresense-style fields from Home Assistant entity state.
- Quality gates:
  - strict confidence threshold (`confidence > minConfidence`)
  - throttling/backpressure in the tracking service
  - optional `last_seen` stale guard in the tracking service
  - stale warning/timeout configuration plumbing for marker rendering
- State model: latest accepted location stored per `entityId` in a persisted store.
- Rendering: floorplan SVG marker creation/update + restore/remove behavior when disabled.
- Dev-only debug overlay: `xyz` / `geo` label rendering, gated off in production builds.
- Tests cover core behavior (extractor, service hardening gates, store semantics, marker rendering).

### 2.2 Remaining (not implemented / future work)

Nothing is required for Phase 1 functionality beyond normal maintenance.

Potential follow-ups (optional), depending on roadmap priorities:

- Transport options beyond HA-mediated updates:
  - Browser MQTT over WebSockets (Option A)
  - backend proxy / addon transport (Option C)
- Coordinate calibration/mapping:
  - origin/rotation/invert-Y configuration
  - per-floor mapping presets
- Smoothing/jitter reduction beyond throttling (EMA / low-pass filter).
- Multi-floor support (use `z` or metadata to select/render floors).
- Developer/operator visibility tools:
  - debug view listing tracked entities, last update age, drops/throttle stats
- Privacy controls (masking, per-user access controls, opt-out).

This feature request exists to:

- keep the integration behavior explicit and testable,
- document constraints and future enhancements,
- guide evolution beyond Phase 1 (smoothing, multi-floor, privacy, alternate transports).

## 3. Goals

Must-have (Phase 1 / foundation):

- Consume location updates produced by ESPresense (directly or via Home Assistant).
- Normalize updates into a stable internal model.
- Apply quality gates (confidence threshold; staleness handling).
- Persist the latest accepted location per entity.
- Render/update floorplan markers based on the store.
- Maintain clean boundaries (DIP): tracking logic independent from rendering.

Should-have (hardening / usability):

- Throttle or debounce per-entity updates to reduce UI thrash.
- Provide dev-only debug overlay showing raw fields.
- Provide clear troubleshooting affordances (logs, debug view).

## 4. Non-goals

- No historical playback or analytics.
- No automatic room assignment/inference in Phase 1.
- No user-facing alerts/notifications (handled elsewhere).
- No in-app coordinate calibration workflow (future).

## 5. Inputs

### 5.1 ESPresense companion attributes (authoritative shape)

When ESPresense data arrives as JSON attributes (commonly retained), expect keys like:

- `x`, `y`, `z` (meters)
- `confidence` (number)
- `fixes` (number)
- `best_scenario` (string)
- `last_seen` (ISO timestamp string or null)
- Optional GPS: `latitude`, `longitude`, `elevation`

### 5.2 Transport options

We should support multiple transports behind abstractions:

- **Option B (Phase 1 default): Home Assistant transport**
  - Subscribe to HA `state_changed` and extract ESPresense-style attributes from `device_tracker.*` entities.
- Option A: Browser MQTT over WebSockets
  - Subscribe to `espresense/companion/+/attributes`.
  - Security concerns: avoid embedding broker credentials.
- Option C: Backend proxy (recommended for production beyond HA transport)
  - Proxy MQTT broker topics and enforce auth/rate limits.

## 6. Output model (normalized)

Define a minimal internal model for accepted updates:

- `entityId: string`
- `position: { x: number; y: number; z?: number }`
- `geo?: { latitude: number; longitude: number; elevation?: number }`
- `confidence: number`
- `lastSeen?: string`
- `receivedAt: number` (client timestamp)

## 7. Configuration requirements

- Confidence gate:
  - Config key: `VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE`
  - Default: `69`
  - Behavior: accept only when `confidence > minConfidence` (strict `>`)

- Staleness:
  - `VITE_TRACKING_STALE_WARNING_MINUTES` default `10`
  - `VITE_TRACKING_STALE_TIMEOUT_MINUTES` default `30`

- Debug overlay:
  - `VITE_FEATURE_TRACKING_DEBUG_OVERLAY`
  - `VITE_TRACKING_DEBUG_OVERLAY_MODE=xyz|geo`
  - Must be disabled in production builds.

## 8. Constraints & architectural requirements

- SOLID/DIP:
  - Tracking extraction/gating must be testable without DOM/SVG.
  - Rendering must consume the store/selectors, not parse payloads.
- Home Assistant integration:
  - Reuse the existing HA connection/services.
  - Avoid adding extra HA WebSocket connections for tracking.
- Strict TypeScript:
  - No `any`; use `unknown` + type guards.

## 9. Rendering requirements (floorplan)

- Markers must be positioned in the floorplan SVG coordinate space.
- Coordinate mapping must be explicit:
  - handle SVG viewBox transforms;
  - handle Y-direction differences (SVG vs ESPresense conventions).
- When tracking is disabled:
  - created markers are removed;
  - markers bound to pre-existing SVG-defined markers are restored.

## 10. Acceptance criteria (Definition of Done)

### Unit tests (pure logic)

- Extractor accepts valid entity state and produces a normalized update.
- Extractor ignores missing required fields (`x`, `y`, `confidence`).
- Confidence boundary behavior:
  - `confidence == minConfidence` is rejected.
  - `confidence > minConfidence` is accepted.

### Service/store tests

- Latest update per entity wins.
- Throttling prevents excessive updates per time window.
- Stop/unsubscribe prevents further updates.

### Component tests (rendering)

- When the store contains a location, the marker exists and is positioned correctly.
- When the location updates, the marker position updates.
- When disabled, markers are removed/restored appropriately.

## 11. Future enhancements

- Smoothing/jitter reduction (EMA / low-pass filter; configurable).
- Multi-floor support (use `z` or metadata to select floor).
- Calibration/mapping workflow (origin/rotation/invert-Y configuration).
- Privacy controls (masking, opt-out, per-user access controls).
- Transport hardening:
  - backend proxy and rate limiting;
  - avoid storing secrets in the client.

## 12. Links

- Operator wiki: `docs/wiki/LOCATION-TRACKING.md`
- Background notes (historical): `docs/archive/FEATURE-DEVICE-TRACKING-ESPRESENSE.md`
- Implementation details (historical): `docs/archive/DEVICE-TRACKING.md`
