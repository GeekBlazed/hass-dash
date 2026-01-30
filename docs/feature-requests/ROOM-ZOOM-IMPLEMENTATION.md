# ROOM-ZOOM — Implementation Plan (MVP)

**Status:** Draft (implementation)

This document describes the MVP implementation approach for ROOM-ZOOM. For product requirements and UX details, see:

- [ROOM-ZOOM.md](ROOM-ZOOM.md)

---

## MVP Summary

- **Renderer:** SVG path (default runtime).
- **Room detail source:** derived from the existing floorplan model.
- **Overlays in room detail:** show entities for **only the selected room**.
- **Navigation:** room detail has **no room switching**; clicking anywhere on the mini floorplan returns to full floorplan.
- **Room detail camera:** **locked** (no panning/zooming in room view).
- **Layout target:** tablet+ only.
- **Timing:** 1500ms transition (start with linear easing).
- **Mini floorplan placement:** top-right, ~1/6 scale, **10px inset/padding**.

---

## Proposed Architecture

### State (single source of truth)

Introduce a ROOM-ZOOM slice in the existing dashboard store so the stage and overlays can react consistently.

Recommended store shape:

- `roomZoom.mode: 'full' | 'entering' | 'room' | 'exiting'`
- `roomZoom.roomId: string | null`
- `roomZoom.startedAtMs: number | null` (optional; useful for debug/testing)

Camera constraints:

- In `roomZoom.mode === 'room'`, the room-detail camera is **locked**: no panning/zooming input should update any view state.
- Keep the “full floorplan” camera (`stageView`) unchanged while zoomed so exiting returns the user to the same full-map framing.
- Any camera math for room detail should be computed once on entry and treated as fixed for the duration of room mode.

Actions:

- `enterRoom(roomId: string)`
- `exitRoom()`

### Rendering Strategy

In ROOM-ZOOM mode, render **two floorplan layers**:

1. **Mini full floorplan** (top-right)
   - Displays the full floorplan, dimmed.
   - Keeps the selected room highlighted.
   - Acts as the “Back” affordance (click anywhere on it).

2. **Room detail floorplan** (main stage)
   - Derived from the selected room polygon.
   - Grows into place during the transition.
   - Overlays/text/trackers reappear here after the transition.

This approach keeps the existing SVG renderer intact while enabling the “two simultaneous maps” UX.

### Animation Timeline

Use a class-driven animation on a parent container (CSS transitions/keyframes) to avoid complicated JS animation logic.

- During transitions, toggle container classes based on store `roomZoom.mode`.
- Use a single 1500ms duration constant for all coordinated transitions.

Suggested CSS state classes:

- `.room-zoom--entering`
- `.room-zoom--room`
- `.room-zoom--exiting`

---

## Task Breakdown (MVP)

### 1) Add store state + actions

**Files (initial targets):**

- [src/stores/useDashboardStore.ts](../../src/stores/useDashboardStore.ts)

Tasks:

- Add `roomZoom` state slice with `mode` + `roomId`.
- Add actions `enterRoom(roomId)` and `exitRoom()`.
- Ensure persisted state migration stays sane (roomZoom should likely NOT be persisted for MVP).

Acceptance:

- Store exposes room zoom state and actions.
- Room zoom state resets reliably on refresh.

---

### 2) Derive room-detail view data from the floorplan model

**Files (new):**

- `src/features/roomZoom/deriveRoomDetailFromFloorplan.ts`
- `src/features/roomZoom/pointInPolygon.ts`

**Files (existing, reference):**

- [src/features/model/floorplan.ts](../../src/features/model/floorplan.ts)
- [src/components/dashboard/stage/floorplanViewBox.ts](../../src/components/dashboard/stage/floorplanViewBox.ts)

Tasks:

- Add helper to resolve selected room polygon + bounds.
- Compute a stable room-detail viewBox:
  - include a small padding margin so walls aren’t flush to edges
  - account for reserved “mini map” area (top-right) by shifting/clamping the room detail view

Acceptance:

- Given (model, roomId), we can compute:
  - room polygon points
  - bounding box
  - derived viewBox for room rendering

---

### 3) Wire stage rendering: full vs room-zoom layout

**Files (initial targets):**

- [src/components/dashboard/stage/FloorplanCanvas.tsx](../../src/components/dashboard/stage/FloorplanCanvas.tsx)
- [src/components/dashboard/stage/FloorplanSvg.tsx](../../src/components/dashboard/stage/FloorplanSvg.tsx)

Tasks:

- Add a new stage wrapper component (recommended):
  - `src/components/dashboard/stage/RoomZoomStage.tsx`
- In `FloorplanCanvas`, branch based on `roomZoom.mode`:
  - `full`: existing `FloorplanSvg` + `OverlayManager`
  - `entering/room/exiting`: render `RoomZoomStage`

Implementation notes:

- `FloorplanSvg` currently manages a local `activeRoomId` for selection highlighting.
  - For ROOM-ZOOM, promote “selected room” to the store (`roomZoom.roomId`) so:
    - both mini/full and room detail can highlight consistently
    - overlay filtering can key off the same selection

Acceptance:

- Clicking a room triggers store `enterRoom(roomId)`.
- In room mode, the UI displays both:
  - mini floorplan (top-right)
  - room detail floorplan (main)

---

### 4) Implement animation + styling

**Files (initial targets):**

- [public/style.css](../../public/style.css)

Tasks:

- Add CSS layout rules for:
  - mini floorplan positioning with **10px inset/padding**
  - room detail stage sizing to avoid overlap
- Add animation rules (1500ms) implementing the required timeline:
  1. fade out labels/icons/trackers
  2. invert selected room background
  3. overlay selected room outline
  4. shrink/slide full floorplan to top-right (1/6 scale) and dim it to 50% opacity
  5. grow room layer to fill remaining stage
  6. fade overlays/labels back in for room view
- Add `prefers-reduced-motion` handling:
  - reduce animation to quick fades (or instant state switch) while maintaining UX.

Acceptance:

- Transition visibly matches the ordered steps in [ROOM-ZOOM.md](ROOM-ZOOM.md).
- Total duration is 1500ms.
- Mini map uses 10px inset.

---

### 5) Filter overlays/entities to “only this room” in room detail

**Files (initial targets):**

- [src/components/dashboard/stage/OverlayManager.tsx](../../src/components/dashboard/stage/OverlayManager.tsx)
- [src/components/dashboard/stage/HaRoomLightingOverlayBridge.tsx](../../src/components/dashboard/stage/HaRoomLightingOverlayBridge.tsx)
- [src/components/dashboard/HaAreaClimateOverlayBridge.tsx](../../src/components/dashboard/HaAreaClimateOverlayBridge.tsx)
- [src/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx](../../src/components/dashboard/stage/TrackedDeviceMarkersBridge.tsx)

Approach:

- Add a selector: `const roomId = useDashboardStore((s) => s.roomZoom.roomId)`.
- If `roomId` is non-null AND we are in room detail mode:
  - Lighting: render toggles only for that room.
  - Climate: render only the room-climate label for that room.
  - Tracking: render markers only if their location falls within the selected room polygon.

Notes:

- Tracking filter likely requires a point-in-polygon test using the room polygon and the device location’s `x,y`.
- If a device location is missing usable coordinates (or is stale/hidden already), it should not render.

Acceptance:

- In room detail mode, no entities/overlays appear outside the selected room scope.
- In full mode, existing overlay behavior is unchanged.

---

### 6) Disable room switching while zoomed

**Files (initial targets):**

- [src/components/dashboard/stage/FloorplanSvg.tsx](../../src/components/dashboard/stage/FloorplanSvg.tsx)

Tasks:

- When `roomZoom.mode !== 'full'`, ignore room click events on the room detail floorplan (and/or remove pointer events from room shapes).
- Mini floorplan click returns to full (calls `exitRoom()`).

Acceptance:

- Clicking rooms while in room detail does not switch rooms.
- Clicking anywhere on the mini floorplan exits.

---

### 7) Testing

**Files (initial targets):**

- [src/components/dashboard/stage/FloorplanSvg.test.tsx](../../src/components/dashboard/stage/FloorplanSvg.test.tsx)
- [src/components/dashboard/stage/TrackedDeviceMarkersBridge.test.tsx](../../src/components/dashboard/stage/TrackedDeviceMarkersBridge.test.tsx)
- [src/components/dashboard/stage/HaRoomLightingOverlayBridge.test.tsx](../../src/components/dashboard/stage/HaRoomLightingOverlayBridge.test.tsx)
- Add new tests for `deriveRoomDetailFromFloorplan`.

Suggested test cases:

- Enter room zoom via click/keyboard.
- Presence of mini floorplan container and 10px inset class/style.
- Exit room zoom by clicking mini floorplan.
- Overlay filtering:
  - lighting only renders for selected room
  - climate only for selected room
  - tracking only for selected room (with point-in-polygon)
- Reduced motion mode switches state without long animations.

Acceptance:

- `pnpm test` passes.
- Coverage remains ≥ 80%.

---

## Implementation Notes / Risks

- **DOM-based overlays:** Some overlays currently inject into SVG layers by DOM id (e.g., `#labels-layer`, `#devices-layer`). With two simultaneous SVGs, each needs unique ids, or overlays need to target the active SVG instance.
  - MVP recommendation: give each SVG instance unique root ids (e.g., `floorplan-svg` vs `floorplan-mini-svg` vs `floorplan-room-svg`) and update overlay code to target the correct one based on `roomZoom` state.

- **Selection highlight consistency:** `FloorplanSvg` currently uses local state for selection; ROOM-ZOOM will work best if selection is stored centrally.

- **Mini map interactivity:** The mini map should be “click anywhere to exit”. Avoid nested interactive elements inside it.

---

## Validation Checklist (MVP)

- `pnpm lint`
- `pnpm type-check`
- `pnpm test` (or `pnpm test:run`)
- `pnpm build`

---

## Follow-ups (Post-MVP)

- Separately-authored room detail assets (per-room geometry and layout).
- Optional easing tweaks and shorter transitions.
- Better mini map interaction affordance (hover/focus ring, tooltip).
- Room-to-room transitions (explicitly not in MVP).
