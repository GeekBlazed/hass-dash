# Prototype → React UI Migration Plan

This document outlines a practical, incremental path to take the working single-file prototype in `UI--IGNORE/floorplan-prototype.html` and implement the same UI in the production React/Vite app under `src/`.

The goal is **UI parity** (layout, panel switching behavior, and overlay visibility), while keeping the architecture consistent with this repo (TypeScript strict, feature flags, DI, tests).

---

## Goals

- Recreate the prototype UI in React (sidebar + quick actions + stage/floorplan + map controls).
- Keep the **panel model** identical:
  - Sidebar panels are mutually exclusive.
  - “Quick actions” select the active panel.
  - Map overlay layers show/hide based on the active panel.
- Preserve the prototype’s current non-fatal behavior:
  - If lighting data is missing/unparseable, Lighting panel shows: **“There are no lights on.”**
- Deliver in small PRs behind a feature flag, so `main` stays deployable.

## Non-goals (for the UI parity milestone)

- Home Assistant integration (REST/WebSocket).
- Persisting lighting changes back to YAML.
- Adding new features beyond what the prototype already demonstrates.

---

## Key prototype behaviors to mirror

### Layout

- Two-column app layout:
  - **Sidebar** (brand + weather + quick actions + panel area)
  - **Stage** (floorplan SVG + map controls)

### Panels (mutually exclusive)

- Agenda (default)
- Climate
- Lighting
- (Media exists in the prototype; treat similarly if you plan to keep it)

### Overlays

- Overlays are implemented as SVG layers (`<g>` groups).
- Climate overlay visibility is tied to Climate panel selection.
- Lighting overlay visibility is tied to Lighting panel selection.

### Lighting specifics

- Lighting panel lists only lights with `state: on`.
- If there are no ON lights (or YAML missing/unparseable), show the empty message.
- Rooms that have lights get a lightbulb toggle button under the room label in a dedicated overlay layer.
- Toggling lighting is **local-only** (in-memory) for now.

---

## Migration strategy (recommended)

### Principle: separate “engine” from “shell”

- **Shell (React):** layout, panels, interactions, accessibility.
- **Engine (framework-agnostic TS):**
  - parsing/normalization of data (YAML for now)
  - floorplan geometry normalization
  - coordinate transforms and view state

This keeps the production app maintainable and makes it easy to evolve the data sources (YAML → HA entities) without rewriting UI.

---

## Step-by-step plan

### 1) Freeze the prototype as the source-of-truth spec

- Identify the UI states that must match:
  - Which quick actions exist and what they do
  - Which panels exist and what they show
  - Which overlays exist and when they appear
  - Empty-state copy
- Capture 3–5 screenshots (desktop + mobile breakpoint) to use as visual references during porting.

#### Acceptance Criteria (Step 1)

- You can point to a stable “spec” version of `UI--IGNORE/floorplan-prototype.html`.

---

### 2) Add a feature flag for the new React UI

Add a flag (example):

- `VITE_FEATURE_PROTOTYPE_UI=false`

Use it to switch the app between:

- existing dashboard scaffold
- new prototype-parity UI

#### Why

- Allows incremental rollout without breaking current UI.

#### Acceptance Criteria (Step 2)

- Toggling the flag switches between UIs.

---

### 3) Implement the prototype layout in React (no data yet)

Create a new top-level feature component (example naming):

- `src/components/prototype--IGNORE/PrototypeShell.tsx` (reference implementation)

Structure:

- Sidebar component
- Stage component

Use Tailwind tokens already present in the repo (do not hard-code new colors).

#### Acceptance Criteria (Step 3)

- Page layout matches prototype at a glance (spacing, two-column, rounded frame feel).

---

### 4) Implement panel state + Quick Actions in React

Create a small, explicit state machine:

- `activePanel: 'agenda' | 'climate' | 'lighting' | 'media'`

Rules:

- Exactly one panel is active at a time.
- Clicking the active quick action returns to the default panel (match prototype behavior if applicable).

#### Acceptance Criteria (Step 4)

- Quick actions visually reflect selection.
- Only one sidebar panel is visible.

#### Testing (Step 4)

- RTL: clicking Climate shows Climate panel and hides others.

---

### 5) Port the panels (static first)

Implement React versions of:

- Agenda panel
- Climate panel
- Lighting panel

Start with static content or mocked model objects to verify layout and scrolling.

#### Acceptance Criteria (Step 5)

- Lighting panel scroll behavior is correct (list scrolls within available height).
- Lighting empty state message is visible when list is empty.

#### Testing (Step 5)

- RTL: when lights list is empty, renders “There are no lights on.”

---

### 6) Port the floorplan renderer into React

Short-term (fastest UI parity):

- Use an inline `<svg>` inside a React component.
- Implement pan/zoom via:
  - `viewBox` manipulation, or
  - a root `<g transform="translate(...) scale(...)">`.

Longer-term (per roadmap):

- Move to Konva (`react-konva`) once the floorplan data model is stable.

#### Acceptance Criteria (Step 6)

- Floorplan renders.
- Pan/zoom controls work.
- Room hover/active interactions work.

---

### 7) Add overlay layers (Climate + Lighting)

Represent layers explicitly:

- base room layer
- devices layer
- climate overlay layer
- lighting overlay layer

Visibility rules:

- climate overlay visible only when `activePanel === 'climate'`
- lighting overlay visible only when `activePanel === 'lighting'`

#### Acceptance Criteria (Step 7)

- Switching panels toggles overlays exactly like the prototype.

---

### 8) Move prototype parsing/normalization logic into TypeScript modules

Extract (or re-implement cleanly) into TS (examples):

- `src/features/floorplan/parsing/*`
- `src/features/floorplan/model/*`

Recommended responsibilities:

- `parseYaml(text): unknown` (or use a library)
- `normalizeFloorplan(doc): FloorplanModel`
- `normalizeDevices(doc): DeviceModel[]`
- `normalizeClimate(doc): ClimateModel`
- `normalizeLighting(doc): LightingModel`

#### Important

- Keep these modules framework-agnostic (no DOM calls).

#### Acceptance Criteria (Step 8)

- Unit tests cover normalizers (happy path + missing/invalid YAML).

---

### 9) Decide how prototype data is supplied to React during the parity phase

You have two viable options:

#### Option A (recommended for dev parity): serve YAML from `public/`

- Copy the prototype YAML into `public/data/`
- Fetch via `fetch('/data/floorplan.yaml')`

Pros:

- Mirrors prototype behavior (fetch-based).

Cons:

- You are still carrying YAML files temporarily.

#### Option B: convert YAML → JSON and commit JSON

- Convert `floorplan.yaml` into JSON and fetch JSON instead

Pros:

- Closer to production-friendly format.

Cons:

- One-time conversion effort; less “prototype identical”.

#### Note on repo rules

- The repo currently ignores `*--IGNORE*` via `.gitignore`. If you want YAML committed for the React app parity stage, prefer placing them under `public/data/`.

---

### 10) Wire panels to real data models (still local-only)

- Load YAML (or JSON) into models.
- Feed models into panels and overlay renderers.

Lighting parity rules:

- List only ON lights.
- Missing/unparseable lighting data → treat as empty and show the empty message.

#### Acceptance Criteria (Step 10)

- With sample data, the UI matches prototype behavior end-to-end.

---

### 11) Add DI + services (optional for parity, helpful for future)

If you want to keep architecture consistent:

- Introduce interfaces for data sources even during the parity phase.

Examples:

- `IFloorplanDataSource` (fetches floorplan definition)
- `ILightingDataSource`

Then swap implementations later:

- Prototype YAML data source (dev)
- Home Assistant-backed data source (future)

---

### 12) Hardening: accessibility, testing, and regression protection

- Validate keyboard navigation:
  - Quick actions are buttons
  - Panels are announced appropriately
  - Focus states are visible
- Add tests:
  - panel toggling
  - lighting empty state
  - overlay visibility rules

#### Acceptance Criteria (Step 12)

- Tests cover key UI parity behaviors.
- New UI maintains repo coverage standards.

---

## Component mapping (prototype → React)

- Prototype `.frame/.app` → React layout wrapper (new)
- Sidebar brand/weather/quick actions → new React `Sidebar` + `QuickActions`
- Prototype panels (Agenda/Climate/Lighting/Media) → React panel components
- Prototype SVG floorplan + layers → React `Floorplan` component + overlay render helpers
- Prototype map controls → React `MapControls` component

---

## Prototype UI component inventory (prototype → React)

This section is a concrete inventory of the UI “pieces” that exist in the single-file prototype, separated into:

- **Reusable / extendable primitives** (worth turning into components or shared patterns)
- **Unique / prototype-only elements** (keep as-is during parity; can be refactored later)

The intent is to avoid guesswork and keep the React port faithful while still being component-driven.

### Reusable / extendable primitives

#### Layout + surfaces

- **Viewport wrapper**: `.viewport`
  - Centers the frame with outer padding (prototype-only in the long run, but useful as a dev harness).
- **Frame (glass shell)**: `.frame` (+ `::before`, `::after`)
  - The rounded “glass” container and lighting/vignette overlays.
- **App grid**: `.app`
  - Two-column layout (sidebar + stage) with responsive stacking.
- **Panel surface**: `.sidebar`, `.stage`
  - Shared glass surface treatment (radius, border, blur, shadow).

#### Sidebar building blocks

- **Brand header**: `.brand` (+ `.title`)
  - Icon + title + divider.
- **Weather summary card**: `.weather` (+ `.temp`, `.desc`, `.meta`)
  - Icon + primary value + supporting lines.
- **Quick action button**: `.qa`
  - A11y: uses `aria-controls` + `aria-expanded`.
  - Visual states:
    - hover
    - focus-visible
    - selected (`.qa[aria-expanded='true']`)

#### Panels / cards

- **Tile container**: `.tile` (+ `.tile::before`)
  - Shared card container used by Lighting/Media/Climate.
- **Scrollable panel body**: `.agenda`, `#lighting-list`, `.media-window`, `.climate-panel`
  - Pattern: fixed region with `overflow: auto` inside the sidebar.
- **List item card**:
  - Agenda: `.agenda .item` (+ `.name`, `.time`)
  - Lighting: `.lighting-panel .lighting-item` (+ `.lighting-name`, `.lighting-meta`)
- **Empty state callout**: `.lighting-panel__empty`
- **Media control primitives** (even if the prototype uses them only in Media):
  - Control bar: `.controls`
  - Button grid: `.buttons` + `.btn`
  - Scrubber: `.scrub`
- **Pill / chip**:
  - Media: `.media-window__pill`
  - Climate: `.climate-panel__pill`

#### Floorplan + overlays

- **Floorplan container**: `.floorplan`
  - Owns padding/inset around the SVG.
- **Empty overlay**: `.floorplan-empty` and children (`__panel`, `__title`, `__body`, `__actions`, `__btn`)
- **Map controls (floating overlay)**:
  - Palette: `.map-controls`
  - Toggle button: `.map-controls-toggle`
  - Buttons: `.map-controls__btn`, `.map-controls__close`
  - Slider: `.map-controls__slider`

#### SVG interaction primitives (YAML-driven)

- **Interactive room group**: `.room`
  - States: hover, active (`.is-active`), focus-visible.
- **Room shape / label**: `.room-shape`, `.room-label`
- **Room climate label**: `.room-climate` (+ `.is-hidden`)
- **Room label group state styling**: `.room-label-group.is-hover|is-focus|is-active`
- **Room light toggle (lighting overlay)**:
  - `.light-toggle` (+ `.is-hidden`, `.is-on`)
  - `.light-toggle-bg`, `.light-toggle-icon`
- **Node marker**: `.node-dot`, `.node-label`
- **Device marker**: `.device-marker`, `.device-pin`, `.device-label`

### Unique / prototype-only elements

- **SVG `<defs>` assets** (filters/gradients/symbols): `#roomInnerGlow`, `#softGlow`, `#devicePin`, `#lightBulb`, gradients, etc.
  - Treat as “assets” rather than React components during parity.
- **Map controls “Launch view values” readout**: `#map-launch-*`
  - Prototype/debug telemetry; keep if useful, otherwise safe to drop later.
- **Status debug output block**: `.status-block` / `#floorplan-status`
  - Prototype-only; currently hidden by CSS.
- **Security/Cameras quick actions** are placeholders
  - Styled as `.qa`, but they don’t open panels in the prototype.

### Proposed React component breakdown (parity-oriented)

These names are suggestions to keep the port organized; they should still follow the prototype UX exactly.

- `PrototypeShell` (layout wrapper)
- `PrototypeSidebar`
  - `BrandHeader`
  - `WeatherSummary`
  - `QuickActions`
    - `QuickActionButton`
  - `SidebarPanelHost` (mutually exclusive panel container)
    - `AgendaPanel`
    - `LightingPanel`
      - `LightingList`
      - `LightingListItem`
      - `EmptyState`
    - `ClimatePanel`
      - `ThermostatSummary`
      - `TemperatureRange`
    - `MediaPanel` (if kept)
- `PrototypeStage`
  - `FloorplanCanvas` (SVG wrapper)
    - `FloorplanEmptyOverlay`
  - `MapControls` + `MapControlsToggle`

---

## Suggested incremental PR breakdown

1. Feature flag + empty `PrototypeShell`
2. Layout parity (no data)
3. Panel state + quick actions
4. Panels (static)
5. Floorplan (static SVG)
6. Pan/zoom controls
7. Overlay visibility rules
8. Data loading + normalizers + unit tests
9. Wire Lighting + Climate to models

---

## Done definition (UI parity milestone)

- React UI matches prototype layout and behavior for:
  - panel switching
  - overlay visibility
  - lighting empty state
  - lighting ON list scroll
  - map controls / pan / zoom
- No new UX beyond prototype.
- Covered by RTL/unit tests.
- Feature-flagged and safe to merge.
