# Feature: Device / Person / Pet Tracking (Phase 1: ESPresense Device Location)

**Status:** Proposed (design doc)

## 1. Summary

We want to track the live location of devices (and later people/pets) on the floorplan/map by subscribing to ESPresense updates delivered over MQTT.

In practice, ESPresense-companion publishes device tracker state + attributes over MQTT using Home Assistant MQTT discovery, so we can consume these updates either:

- Indirectly via Home Assistant WebSocket entity updates (recommended for Phase 1 in this repo, since HA integration already exists), or
- Directly via MQTT (WebSocket MQTT / backend proxy).

Phase 1 scope: **device location tracking**.

The application will:

- Subscribe to an MQTT topic (or topic pattern) that carries ESPresense-style presence/location updates.
- Parse incoming messages.
- For each device update, **only apply the position update when `confidence > threshold`**.
- Push accepted updates into application state so the floorplan/map can re-render device markers.

The confidence threshold must be adjustable via configuration.

## 2. Goals

- Consume ESPresense MQTT event messages and extract device coordinates (`x`, `y`, optional `z`).
- Update a per-device “latest known position” model in near-real-time.
- Filter updates based on a configurable `confidence` threshold (initially `> 69`).
- Keep the tracking logic independent from the floorplan UI rendering (SOLID/DIP).

## 3. Non-goals (for Phase 1)

- No new UI beyond whatever marker system already exists.
- No historical playback, heatmaps, or analytics.
- No “room assignment” inference (e.g., mapping coordinates to a room).
- No person/pet aggregation logic (Phase 2+).
- No Home Assistant entity creation; we only consume messages.

## 4. Inputs

### 4.1 Authoritative: ESPresense-companion MQTT topics + payloads

Based on the ESPresense-companion source:

- Home Assistant MQTT discovery messages are published/consumed on:
  - `homeassistant/device_tracker/{discoveryId}/config` (discovery topic is configurable; default is `homeassistant`)
  - Discovery payload includes:
    - `state_topic`: `espresense/companion/{deviceId}`
    - `json_attributes_topic`: `espresense/companion/{deviceId}/attributes`
    - `status_topic`: `espresense/companion/status`

- Device tracker **state** is published on:
  - `espresense/companion/{deviceId}`
  - Payload is a string like the resolved room name (or `not_home`).

- Device tracker **attributes** are published (retained) on:
  - `espresense/companion/{deviceId}/attributes`
  - Payload is JSON; keys include:
    - `x`, `y`, `z`
    - `confidence` (number)
    - `fixes` (number)
    - `best_scenario` (string)
    - `last_seen` (ISO timestamp or null)
    - Optional GPS keys when configured in ESPresense-companion: `latitude`, `longitude`, `elevation`

Example attributes payload:

```json
{
  "source_type": "espresense",
  "x": 2.7473150322009507,
  "y": 1.9257382372352163,
  "z": 0.9015358659193731,
  "confidence": 74,
  "fixes": 0,
  "best_scenario": "Default",
  "last_seen": "2026-01-07T09:15:53.7063821Z"
}
```

### 4.2 Example: Home Assistant WebSocket event envelope

When consuming via the Home Assistant WebSocket API, these same MQTT-backed device tracker updates may arrive wrapped in an HA event envelope (exact shape depends on HA versions/settings). Example payload:

```json
{
  "type": "event",
  "event": {
    "c": {
      "device_tracker.phone_jeremy": {
        "+": {
          "lc": 1767777353.7086658,
          "c": "01KEBVVFZC9D8C1NXFGQA778EN",
          "a": {
            "x": 2.7473150322009507,
            "y": 1.9257382372352163,
            "z": 0.9015358659193731,
            "confidence": 74,
            "last_seen": "2026-01-07T09:15:53.7063821Z"
          }
        }
      }
    }
  },
  "id": 3
}
```

Observations (based on this sample):

- `event.c` appears to be a dictionary keyed by entity id (e.g., `device_tracker.phone_jeremy`).
- Each entry contains a nested object with a `"+"` key, suggesting a delta/update.
- `event.c[entityId]["+"]` contains:
  - `a`: attributes (includes `x`, `y`, `z`, `confidence`, `last_seen`)
  - other metadata (`lc`, `c`, etc.)

## 5. Phase 1 Output Model

A minimal internal model for location updates:

- `entityId: string` (e.g., `device_tracker.phone_jeremy`)
- `position: { x: number; y: number; z?: number }`
- `confidence: number`
- `lastSeen: string | undefined` (ISO string if present)
- `receivedAt: number` (client timestamp `Date.now()`)

We will store the **latest accepted** update per device.

## 6. Confidence Threshold Configuration

Initial behavior:

- Accept update only when `confidence > 69`.

This must be configurable. Proposed configuration surface:

- `VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE` (number)
  - Default: `69`
  - Comparison: `confidence > minConfidence`

Notes:

- This is deliberately a single knob for Phase 1.
- We may later add per-device overrides, smoothing filters, or z-handling rules.

## 7. Architecture (Proposed)

### 7.1 Services / Interfaces (DIP)

Introduce a small set of abstractions so tracking remains swappable:

- Phase 1 transport (recommended in this repo): reuse our existing HA integration:
  - `IEntityService` (`subscribeToStateChanges`) as the event source
- Future transport options (later iterations):
  - `IMqttClient` (connect/subscribe/unsubscribe, message callback)
- `IDeviceLocationTrackingService`
  - Subscribes to a transport (HA entity updates or MQTT)
  - Extracts location fields
  - Emits normalized location updates
- `IDeviceLocationStore` (likely Zustand store or service wrapper)
  - `upsertLocation(entityId, location)`

The floorplan/map UI should depend only on the store/selectors.

### 7.2 Data Flow

1. App boots and creates MQTT connection (implementation TBD).
2. Tracking service subscribes to ESPresense topic(s).
3. On message:
   - Parse JSON (fail-safe: ignore invalid JSON).
   - If message matches expected shape, iterate device entries.
   - Extract `x/y/z`, `confidence`, `last_seen`.
   - Apply confidence filter (`confidence > minConfidence`).
   - Update store for each accepted device update.
4. Floorplan/map reads from store and re-renders markers.

### 7.3 MQTT Topic Details

We need to decide how the app receives the messages:

- Option A: Direct MQTT connection from the browser (WebSocket MQTT)
- Option B: Consume via Home Assistant WebSocket/Events (HA as transport)
- Option C: Backend proxy to broker (recommended for production security)

For Phase 1 prototyping in this repo, Option B is likely fastest (HA integration already exists). For production, Option C is likely safest.

If consuming via MQTT directly, ESPresense-companion uses:

- `espresense/companion/+/attributes` (JSON payload described in 4.1)
- `espresense/companion/+` (string state; room name / `not_home`)

If consuming via Home Assistant, the same values surface as entity state/attributes on `device_tracker.*` entities created via MQTT discovery.

Regardless of transport, the tracking service should be fed “message payload strings” and not care whether it came from HA or raw MQTT.

## 8. Mapping Device Positions to the Floorplan

Phase 1 assumption:

- The ESPresense coordinate system (`x/y/z`) is already aligned to the floorplan/map coordinate system.

We still need a mapping contract:

- `entityId` in messages must match the id used by our device marker system.
- If our floorplan uses a different id (e.g., `phone_jeremy` vs `device_tracker.phone_jeremy`), add a simple mapping layer:
  - `entityId -> markerId`

## 9. Error Handling / Resilience

- Invalid JSON: ignore the message.
- Missing fields (`x`, `y`, `confidence`): ignore that device entry.
- Out-of-range numeric values: ignore entry (optional; can be added later).
- If MQTT disconnects: attempt reconnect (handled by the transport).

## 10. Testing Strategy

- Unit tests for the message parser:
  - Valid sample parses and emits expected updates.
  - Confidence threshold filters correctly (`69` boundary behavior).
  - Ignores invalid JSON and malformed shapes.
- Store tests:
  - Latest update overwrites prior.
  - Optional persistence decisions (if any) do not grow unbounded.

## 11. Security & Privacy Notes

- Location tracking is sensitive. For production:
  - Avoid embedding credentials in the client.
  - Prefer a backend proxy or HA-mediated transport.
  - Minimize logging of raw payloads.

## 12. Future Work

- Person/pet tracking:
  - Map multiple devices to a person/pet.
  - Resolve conflicts and pick “best” source (highest confidence, freshest).
- Smoothing:
  - Debounce/jitter filtering.
  - Optional Kalman/EMA.
- Floor/level support:
  - Use `z` or beacon metadata to infer floor.
- Room attribution:
  - Convert coordinates to a room id for UI summaries.

---

## 13. Implementation Plan (Iterative)

Each iteration is designed to be:

- Small and reviewable
- Shippable behind feature flags where appropriate
- Verifiable with **automated tests** (clear yes/no DoD)

### Iteration 1: Message Parsing + Confidence Gate (Pure Logic)

**Goal:** Convert incoming updates into normalized device location updates, filtered by confidence threshold.

**Deliverables:**

- A pure extractor function (no side effects) that accepts either:
  - An HA `HaEntityState` (preferred for Phase 1), or
  - A raw JSON payload string (optional / later)
    and returns zero or more location updates.
- Confidence filter uses `minConfidence` from configuration (initially env-backed).

**Definition of Done (Automated Checklist):**

- [ ] Unit test: valid `HaEntityState` for `device_tracker.phone_jeremy` yields an update with expected `x/y/z/confidence/last_seen`.
- [ ] Unit test: invalid JSON returns zero updates and does not throw.
- [ ] Unit test: missing required fields (`x`/`y`/`confidence`) yields zero updates.
- [ ] Unit test: confidence is rejected when `confidence <= minConfidence`.
- [ ] Unit test: confidence is accepted when `confidence > minConfidence`.

### Iteration 2: Tracking Store (Latest Known Position)

**Goal:** Persist the latest accepted location per device in app state.

**Deliverables:**

- A small store (likely Zustand) keyed by `entityId`:
  - `locationsByEntityId: Record<string, DeviceLocation>`
  - `upsert(entityId, location)`
  - `clear()`

**Definition of Done (Automated Checklist):**

- [ ] Unit test: `upsert()` inserts a new device location.
- [ ] Unit test: `upsert()` overwrites the same entity id (latest wins).
- [ ] Unit test: `clear()` resets state.

### Iteration 3: Transport Abstraction (No Real Broker Yet)

**Goal:** Introduce a transport boundary so the tracking service can consume updates without binding to a specific implementation.

**Deliverables:**

- A `DeviceLocationTrackingService` that wires:
  - transport subscription → extractor → confidence gate → store updates
- For Phase 1, implement a Home Assistant-backed source using `IEntityService.subscribeToStateChanges()`.
- Provide a minimal in-memory/mock source for tests.

**Definition of Done (Automated Checklist):**

- [ ] Unit test: emitting a valid entity update through the mock source causes a store update.
- [ ] Unit test: low-confidence update does not update store.
- [ ] Unit test: calling `stop()`/unsubscribe prevents further updates.

### Iteration 4: Config Plumbing (Env-backed)

**Goal:** Read `VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE` from config and enforce it end-to-end.

**Deliverables:**

- A small config reader (service or pure helper) that returns `minConfidence: number` with safe default.
- Tracking service uses this value (not a hard-coded literal).

**Definition of Done (Automated Checklist):**

- [ ] Unit test: missing/invalid env value falls back to default `69`.
- [ ] Unit test: env value `69` rejects confidence `69` but accepts `70` (strict `>` behavior).

### Iteration 5: UI Wiring (Map/Floorplan Marker Updates)

**Goal:** Visualize tracked device positions using the existing marker rendering system.

**Deliverables:**

- A selector/hook to read device locations from the store.
- A marker-layer integration that renders/updates positions when store changes.

**Definition of Done (Automated Checklist):**

- [ ] Component test: when the store contains a location for an entity, the corresponding marker is rendered at the expected coordinates.
- [ ] Component test: when location updates, marker position updates.

### Iteration 6: Integration Transport (Phase 1 Default)

**Goal:** Connect to a real message source.

**Default for this repo (Phase 1):**

- **B: HA-mediated events** (use HA as the transport via `IEntityService.subscribeToStateChanges()`)

**Later options:**

- **A: Browser MQTT over WebSockets** (requires broker ws endpoint)
- **C: Backend proxy** (production-friendly)

**Deliverables:**

- One concrete implementation that can subscribe and receive updates (HA-based for Phase 1).
- Feature-flagged enablement to avoid breaking default builds.

**Definition of Done (Automated Checklist):**

- [ ] Integration test (mocked transport boundary) proves subscription is attempted on start.
- [ ] Unit test: unsubscribe is called on stop/unmount.

### Iteration 7: Hardening (Backpressure + Safety)

**Goal:** Prevent UI thrash and reduce noise.

**Deliverables (pick minimal set):**

- Debounce/throttle updates per entity id (time-based).
- Ignore stale updates using `last_seen` (optional).

**Definition of Done (Automated Checklist):**

- [ ] Unit test: throttling prevents more than N updates per time window.
- [ ] Unit test: stale `last_seen` does not overwrite a newer stored value (if enabled).
