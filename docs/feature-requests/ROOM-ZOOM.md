# Feature Request: ROOM-ZOOM

**Status:** Draft (requirements)

## Purpose

Provide an animated, intuitive transition from the full floorplan map to an individual **room detail** map and back again.

The transition should clearly communicate context (where you came from), preserve orientation (what room you’re in), and feel responsive on both desktop and touch devices.

---

## Goals

- User can click/touch a room in the full floorplan to “zoom into” that room.
- Transition uses a multi-step animation that:
  - reduces visual clutter
  - highlights the selected room
  - introduces a room-focused view while keeping a miniature full-floorplan context
- User can return to the full floorplan by clicking/touching the miniaturized full floorplan (reverse animation).

---

## Non-Goals (for initial release)

- Multi-floor navigation (explicitly out of MVP elsewhere).
- Persisting “last room” state across sessions.
- Editing room geometry.
- Physics-based navigation or freeform camera transitions between arbitrary coordinates.
- Small-screen/mobile UX polish (MVP targets tablet+ only).

---

## User Stories

1. **Enter Room Detail**

- As a user, when I click/tap a room in the full floorplan, I transition into a detailed view of that room.

1. **Exit Room Detail**

- As a user, when I click/tap the miniaturized full floorplan, I transition back to the full floorplan.

1. **Maintain Context**

- As a user, I can always tell which room is selected and how it relates to the full layout.

---

## UX / Interaction Requirements

### Entry Trigger

- Rooms must be clickable/touchable targets.
- If a room is not selectable (e.g., missing detail map), the UI must communicate that (cursor, disabled affordance, tooltip, or no-op with feedback).

### Exit Trigger

- While in room detail mode, the miniaturized full floorplan (top-right) must be clickable/touchable to exit.
- The exit transition must reverse the entry animation.
- While in room detail mode, the user cannot select a different room. Clicking anywhere on the mini floorplan returns to the full floorplan.

### Room Detail Camera (Locked)

- While in room detail mode, **panning and zooming are disabled**.
- The selected room is rendered at a fixed position/scale on the canvas (i.e., the room view is **locked**).

### Input Methods

- Desktop: mouse click.
- Tablet: touch tap.
- Keyboard (accessibility):
  - rooms should be focusable and activatable via Enter/Space
  - escape hatch: optional `Escape` to exit room detail (recommended)

### Supported Screen Sizes

- MVP targets tablet-sized viewports and larger.
- Phone-sized layouts are out of scope for MVP.

---

## Animation Requirements (Entry)

### Timing

- Total transition duration: **1500ms**.
- Easing: **TBD** (default to linear unless we decide otherwise).

When entering a room detail view, the animation sequence should be:

1. **De-clutter**

- Fade out room text labels, icons, trackers, and any overlay elements, leaving only the floorplan walls/geometry.

1. **Selected Room Highlight**

- Invert the background color of the selected room.

1. **Room Outline Overlay**

- Overlay a new outline of the selected room (distinct stroke) to emphasize selection.

1. **Miniaturize Full Floorplan**

- Shrink the main floorplan to **1/6** of the visible canvas size and slide it into the **top-right corner**.
- The selected room remains visually selected/inverted in the mini view.
- "Dim" the miniaturized floorplan by setting the opacity to 50%

1. **Bring In Room Detail Layer**

- Grow the new “room layer” (selected room detail floorplan) to fill the remaining visible canvas,
  leaving space so it does not overlap the miniaturized full floorplan.

1. **Reapply UI/Overlays to Room View**

- Fade in room-local text labels, icons, buttons, labels, trackers, etc. for the room detail view.

### Animation Requirements (Exit)

- Clicking/tapping the miniaturized full floorplan triggers the exact reverse sequence.

---

## Layout Requirements

### Room Detail View Composition

- **Top-right:** Mini full floorplan (1/6 scale), always visible while in room detail.
  - Placement: inset **10px** from the top and right edges (and maintain **10px** padding around its container).
- **Main area:** Selected room detail floorplan, sized to avoid overlap with the mini floorplan.

### Mini Map Interaction

- Shows the full floorplan at reduced scale.
- Selected room remains highlighted.
- Acts as the primary “Back” affordance.

---

## Data / Model Requirements

### Room Identity

- Rooms must have stable identifiers (e.g., `room.id`) that can map:
  - full-floorplan room geometry
  - room detail floorplan geometry

### Room Detail Source

- MVP: room detail floorplan is derived from the existing floorplan model.
- Future: allow separately-authored per-room detail data assets.

---

## State Machine (Recommended)

Model ROOM-ZOOM as explicit UI states to avoid edge cases:

- `FullFloorplan`
- `TransitioningToRoom(roomId)`
- `RoomDetail(roomId)`
- `TransitioningToFull(roomId)`

Constraints:

- While transitioning, ignore additional room clicks/taps (or queue the next requested room).
- Ensure transitions are cancel-safe (e.g., if data load fails, return to FullFloorplan).

---

## Performance Requirements

- Target 60fps on typical desktop hardware during transitions.
- Avoid layout thrash:
  - use transforms/opacity where possible
  - prefer a single animation timeline (or coordinated steps) rather than many independent DOM changes
- Prefer rendering reuse:
  - avoid destroying/recreating large layers during transition

---

## Accessibility Requirements (WCAG 2.2 AA)

- Rooms are keyboard focusable and activatable.
- Provide accessible names for rooms (e.g., `aria-label="Open Living Room"`).
- Respect `prefers-reduced-motion`:
  - reduce/disable complex animation
  - still perform the state change (full → room detail) with minimal fades
- Ensure focus management:
  - on enter: move focus to room detail container or a heading
  - on exit: return focus to the originating room in the full floorplan

---

## Error Handling

- If room detail data fails to load, show a clear message and return to `FullFloorplan`.
- Never leave the UI “stuck” mid-transition.

---

## Acceptance Criteria

- Clicking/tapping a room in the full floorplan triggers the specified entry animation and lands in room detail.
- Mini full floorplan appears in the top-right at ~1/6 scale while in room detail.
- Clicking/tapping anywhere on the mini floorplan triggers the reverse animation and returns to the full floorplan.
- Selected room stays highlighted during the entire time room detail is active.
- Works with mouse + touch + keyboard.
- Reduced-motion mode is respected.
- Overlays/entities shown in room detail are limited to "only this room".
- Transition duration is 1500ms.

---

## Open Questions / Suggestions

1. **Easing Choice**

- At 1500ms, easing may be subtle; we can start with linear and revisit after seeing it.

1. **Mini Map Placement Details**

- Padding/inset is defined for MVP: **10px**.
