# Feature: Events, Alerts, and Notifications

## Summary

This feature is about responding to alerts and notifications produced by Home
Assistant. Some alerts and notifications should result in a toaster
notification. Some alerts and notifications will result in other application
responses, such as bringing up a camera feed modal when a person is dedicated
by a camera.

## Types of events, alerts, and notifications to monitor

- Camera detection (people, vehicles, animals, motion, packages)
- Location tracking events (tracker is home/away, tracker is in living room,
  etc.)
- Other device events (door is open, light is on, refrigerator temp is too warm,
  sun is setting, etc.)
- Any kind of notification that is emitted and shown in the Home Assistant
  "Notifications" panel

## Plan: Notifications Monitoring Pipeline

Implement a layered notifications pipeline that combines Home Assistant persistent notifications and entity state transitions into one normalized stream, then drives toast UX plus action hooks (camera modal, panel focus) from that stream. This approach is low-latency, resilient to reconnects, and aligned with existing DI, controller, and Zustand patterns in hass-dash.

### Implementation constraints and defaults

- Event-to-action rule source is not finalized yet and requires discovery.
- Source normalization schema is not finalized yet and requires discovery.
- Camera targeting should use a combination of factors, including area and tagging, plus event context where available.
- Toast notifications are auto-dismiss by default.
- Toast TTL must be env-configurable and defaults to 20 seconds.
- Show at most 3 toasts at a time, with newest at the top.
- Dismissing a visible toast should roll older non-expired items into view.
- Toast and persistent notification content should support rich content (images and rich text).
- Persistent notifications should have a dedicated UI component, separate from transient toasts.
- Do not duplicate persistent notifications or toasts. Track duplicate count and expose it in the UI.
- Persist unread notifications across refresh.
- Feature flags should be env-backed and default to off.
- App runs as a trusted user.
- Before full Home Assistant notification stream wiring is complete, pre-populate persistent notifications with mock/sample data for UI validation.
- Before full notification ingestion, trigger toasts from existing tracked light turn on/off events as the first live signal source.

### Open discovery items

- Final event-to-action rule source and configuration format.
- Final normalized notification schema (including whether to retain source-specific raw payloads for diagnostics).
- Rich content rendering strategy and sanitization rules for markdown/HTML payloads.

### Implementation order update

Start with UI instrumentation first so we can observe real payload shape/frequency during discovery:

1. Build toast presentation + dedicated persistent notifications control first.
2. Wire a minimal store/controller path so incoming test/sample payloads can be rendered immediately.
3. Bootstrap discovery with mock persistent notifications and light on/off toast triggers.
4. Then connect live Home Assistant streams and continue schema/rule discovery with real data.

This means Phase 6 foundational work (toast + persistent notifications UI surfaces) should be pulled forward before full ingestion/action automation work.

### Steps

#### 1. Phase 1 - Monitoring contracts and data model

1.1 Define notification domain types in /home/jeremy/src/hass-dash/src/types/home-assistant.ts and/or a new /home/jeremy/src/hass-dash/src/types/notifications.ts: normalized event envelope, severity, source kind (persistent_notification | alert_state | event_entity), and optional action payload.

1.2 Add a notifications service interface at /home/jeremy/src/hass-dash/src/interfaces/INotificationService.ts with methods for start/stop subscriptions, snapshot hydration, and action callbacks.

1.3 Add feature-flag contract for notifications (VITE_FEATURE_NOTIFICATIONS) and optional action flag (VITE_FEATURE_NOTIFICATION_ACTIONS) consumed through useFeatureFlag hooks. **parallel with step 2.1**

1.4 Add additional env-backed feature flags (default false) for separate capabilities such as toast presentation and persistent notification surface.

1.5 Add env contract for toast TTL (for example: VITE_NOTIFICATIONS_TOAST_TTL_SECONDS, default 20).

1.6 Define normalized notification model fields for dedupe and duplicate tracking (stable dedupe key + duplicateCount).

1.7 Add discovery task: evaluate and document candidate rule-source formats for event-to-action mapping.

1.8 Add discovery task: define normalized schema and whether source raw payload should be stored.

#### 2. Phase 2 - WebSocket subscription capability

2.1 Extend /home/jeremy/src/hass-dash/src/interfaces/IHomeAssistantClient.ts with a typed command-subscription method for websocket commands that emit ongoing event frames (needed for persistent_notification/subscribe).

2.2 Extend /home/jeremy/src/hass-dash/src/services/HomeAssistantWebSocketClient.ts subscription bookkeeping to support a third subscription kind for command streams, including automatic resubscribe in resubscribeAll.

2.3 Pass through the new method in /home/jeremy/src/hass-dash/src/services/QueuedHomeAssistantClient.ts so queue wrapper behavior remains consistent.

2.4 Add/adjust websocket client tests in /home/jeremy/src/hass-dash/src/services/HomeAssistantWebSocketClient.test.ts for command-stream subscribe/unsubscribe/reconnect behavior.

#### 3. Phase 3 - Notification ingestion service

3.1 Implement /home/jeremy/src/hass-dash/src/services/HomeAssistantNotificationService.ts using multiplexing patterns from HomeAssistantEntityService: one upstream subscription per source, N local handlers.

3.2 Source A (primary): subscribe to persistent_notification/subscribe and map current/added/updated/removed updates into normalized records.

3.3 Source B: subscribe to state_changed and filter only alert.\* entity changes; map idle/on/off transitions with dedupe by entity_id + context/time.

3.4 Source C: subscribe to state_changed and filter event.\* entities; map event_type and attributes into normalized events suitable for camera/person detection rules.

3.5 Add bounded in-memory queueing and dedupe windows to avoid UI spam during high-frequency bursts; mirror 50ms batch flush style used by HomeAssistantEntityStoreController where practical.

3.5.1 Dedupe policy: merge duplicate active notifications/events into a single item and increment duplicateCount.

3.5.2 Expose duplicateCount in the view model for UI rendering (button/badge).

3.6 Bind service in DI: update /home/jeremy/src/hass-dash/src/core/types.ts and /home/jeremy/src/hass-dash/src/core/di-container.ts. _depends on 1.2_

3.7 Add service tests in /home/jeremy/src/hass-dash/src/services/HomeAssistantNotificationService.test.ts covering mapping, dedupe, and reconnect recovery.

3.8 Build camera-target resolution strategy using combined signals (event payload, area association, labels/tags, and configured priorities).

#### 4. Phase 4 - Store and controller orchestration

4.1 Add /home/jeremy/src/hass-dash/src/stores/useNotificationStore.ts with: active toasts, optional recent history, dismiss/expire actions, duplicateCount updates, and max-cap retention.

4.1.1 Persist unread notifications across refresh.

4.1.2 Limit visible toast stack to 3 and preserve ordering (newest first).

4.1.3 On dismiss, roll older non-expired notifications into visible slots.

4.2 Add /home/jeremy/src/hass-dash/src/components/dashboard/NotificationController.tsx to wire service subscriptions into store updates and to run action dispatchers.

4.3 Register controller in /home/jeremy/src/hass-dash/src/components/dashboard/DashboardControllers.tsx so lifecycle matches other side-effect controllers.

4.4 Gate controller behavior with feature flags via /home/jeremy/src/hass-dash/src/hooks/useFeatureFlag.ts. _depends on 1.3_

4.5 Add bootstrap seeding path for persistent notifications mock data so UI can be validated before HA stream integration.

4.6 Add bootstrap toast trigger integration from existing tracked light on/off events.

#### 5. Phase 5 - Event-driven actions (camera-focused v1)

5.1 Define action resolution rules in notifications service or a small helper module (for example, detect event.\* payloads indicating person/motion/camera context and emit open-camera action payloads).

5.2 Refactor camera modal control to be externally triggerable: move selected camera modal state from local state in /home/jeremy/src/hass-dash/src/components/dashboard/panels/CamerasPanel.tsx into a shared store slice (either extend useDashboardStore or add a dedicated camera modal store).

5.3 Add an action bridge/controller that consumes notification actions and updates camera modal state + optional panel focus (activePanel = cameras).

5.4 Preserve manual camera interactions; action-driven open should not break existing close/open UX.

#### 6. Phase 6 - Notification UI surfaces

6.1 Add a lightweight toast presenter component (for example /home/jeremy/src/hass-dash/src/components/dashboard/NotificationToasts.tsx) mounted near DashboardShell so it can appear regardless of active panel.

6.1.1 Implement this first in execution order, before full event-ingestion wiring, using mocked/manual payload injection where needed for rapid validation.

6.2 Add toast a11y semantics (role=alert, polite/assertive strategy by severity), dismiss controls, and auto-expire timers.

6.3 Add a dedicated persistent notifications component (separate from transient toasts).

6.3.1 Implement this first in execution order, together with the toast presenter, so discovery work has immediate visual feedback.

6.3.2 Support initial mock-data rendering mode for persistent notifications until live feed mapping is enabled.

6.4 Add rich-content rendering support for toasts and persistent notifications (images + rich text) with explicit sanitization for untrusted HTML/markdown content.

6.5 Optionally add a compact notification history surface (sidebar tile or overlay) if included in v1; keep this behind VITE_FEATURE_NOTIFICATIONS if incomplete.

#### 7. Phase 7 - Validation and rollout

7.1 Targeted tests: new notification service/client/store/controller tests.

7.2 Regression tests: existing entity subscription and camera panel behavior.

7.3 Repo validation commands in order: pnpm test:run (targeted first), pnpm type-check, pnpm build, then pnpm test as broader sweep.

7.4 Manual QA against a Home Assistant instance:

- Create/dismiss persistent notifications and verify current + incremental updates.
- Trigger alert.\* transitions and verify toast cadence and dedupe.
- Trigger event.\* camera/person events and verify camera modal action.
- Verify reconnect (restart HA or network toggle) resubscribes and does not duplicate events.

## Relevant files

- /home/jeremy/src/hass-dash/src/interfaces/IHomeAssistantClient.ts - Add command-stream subscription contract.
- /home/jeremy/src/hass-dash/src/services/HomeAssistantWebSocketClient.ts - Implement and resubscribe command-stream subscriptions.
- /home/jeremy/src/hass-dash/src/services/QueuedHomeAssistantClient.ts - Pass-through new client capability.
- /home/jeremy/src/hass-dash/src/services/HomeAssistantEntityService.ts - Reuse multiplexing + retry model as template.
- /home/jeremy/src/hass-dash/src/components/dashboard/HomeAssistantEntityStoreController.tsx - Reuse batching/dedupe pattern for high-frequency updates.
- /home/jeremy/src/hass-dash/src/types/home-assistant.ts - Add websocket payload types for persistent notification events.
- /home/jeremy/src/hass-dash/src/interfaces/INotificationService.ts - New notifications service contract.
- /home/jeremy/src/hass-dash/src/services/HomeAssistantNotificationService.ts - New ingestion/normalization service.
- /home/jeremy/src/hass-dash/src/stores/useNotificationStore.ts - Notification UI state and retention.
- /home/jeremy/src/hass-dash/src/components/dashboard/NotificationController.tsx - Subscription lifecycle and action dispatch.
- /home/jeremy/src/hass-dash/src/components/dashboard/DashboardControllers.tsx - Mount NotificationController.
- /home/jeremy/src/hass-dash/src/components/dashboard/DashboardShell.tsx - Mount toast presenter surface.
- /home/jeremy/src/hass-dash/src/components/dashboard/panels/CamerasPanel.tsx - Decouple modal open state for action-triggered camera opens.
- /home/jeremy/src/hass-dash/src/stores/useDashboardStore.ts - Potential shared state for action-driven camera modal control.
- /home/jeremy/src/hass-dash/src/core/types.ts - DI symbol for INotificationService.
- /home/jeremy/src/hass-dash/src/core/di-container.ts - DI binding for HomeAssistantNotificationService.
- /home/jeremy/src/homeassistant/core/homeassistant/components/persistent_notification/**init**.py - Confirms persistent_notification/subscribe command and update types.
- /home/jeremy/src/homeassistant/core/homeassistant/components/notify/**init**.py - Confirms notify service behavior (persistent_notification bridge and notify entities).
- /home/jeremy/src/homeassistant/core/homeassistant/components/alert/entity.py - Confirms alert state machine and notify service calls.
- /home/jeremy/src/homeassistant/core/homeassistant/components/event/**init**.py - Confirms event entity state/attributes model.

## Verification

1. Unit-test websocket command-subscription lifecycle and reconnect replay in HomeAssistantWebSocketClient tests.
1. Unit-test HomeAssistantNotificationService normalization for persistent_notification current/added/updated/removed payloads.
1. Unit-test alert/event entity mapping from state_changed payloads.
1. Unit-test notification store retention cap, dedupe, and auto-expire behavior.
1. Component-test NotificationController + toast presenter rendering and dismissal.
1. Component-test camera action dispatch from notification payload into modal open state.
1. Run pnpm type-check and pnpm build (required), then broader tests.

## Acceptance Criteria By Phase

🔘 = Not started ▶️ = In Progress ✅ = Done ⛔ = Blocked

### Phase 1 AC

▶️ In Progress

- Notification types compile under strict TypeScript and include dedupe identity + duplicateCount.
- Env keys for feature flags and toast TTL are defined and documented, with defaults specified.
- Discovery notes are captured for rule-source format and normalized schema.

### Phase 2 AC

✅ Done

- Client supports command-stream subscription for persistent_notification/subscribe.
- Reconnect restores command-stream subscriptions without duplicate handlers.
- Unit tests cover subscribe, unsubscribe, disconnect, and reconnect behavior.

### Phase 3 AC

▶️ In Progress

- Service emits normalized events for persistent_notification updates and state_changed events (alert.\*, event.\*, and selected binary_sensor camera detections).
- Duplicate events merge into a single active item and increment duplicateCount. (Store-level dedupe implemented; service-level burst dedupe strategy still pending)
- Camera detection allow-list is tightened to person/vehicle/animal/package (motion excluded to reduce false positives).
- Camera target resolution uses available payload + source-entity heuristics with deterministic fallback; advanced area/tag priority strategy is still pending.
- Service tests validate mapping, dedupe, and reconnect recovery.

### Phase 4 AC

✅ Done

- Store persists unread notifications across refresh.
- Visible toast stack is capped at 3 with newest first.
- Dismissing a visible toast rolls older non-expired items into view.
- Controller wiring updates store and action hooks without leaking subscriptions.
- Bootstrap mock persistent notifications can be seeded/cleared via development wiring.
- Light on/off events already tracked by the app can emit toasts through the same store/presenter pipeline.

### Phase 5 AC

▶️ In Progress

- Action rules trigger camera-focused workflow for qualifying events via toast CTA/preview click-to-open.
- Camera targeting usually selects the expected entity using payload and source heuristics; advanced multi-factor priority (event context + area + tags) is still pending.
- Existing manual camera open/close interactions remain intact after modal state refactor.

### Phase 6 AC

✅ Done

- Toasts auto-dismiss using env-configured TTL (default 20 seconds, with longer camera-detection TTL currently set to 60 seconds).
- Toast and persistent-notification UIs are separate components.
- Rich content renders correctly, and unsafe HTML/markdown is sanitized before render.
- Duplicate indicator control shows active duplicate count for each deduped item.
- Persistent notifications UI can render both mock seeded data and live mapped data without component changes.
- Camera detection toasts support inline preview and click-through to full modal while dismissing the originating toast.

### Phase 7 AC

▶️ In Progress

- Targeted tests pass for client/service/store/controller.
- pnpm type-check and pnpm build pass.
- Manual QA confirms create/dismiss flows, dedupe behavior, action-triggered camera modal, and preview-click camera open behavior. (Reconnect resilience verification still pending)

## Decisions

- Included scope: persistent notifications, alert entities, event entities, toast UX, and event-driven actions (camera-focused).
- Excluded from v1: generic notify call_service monitoring (admin-only, noisy), broad historical notification center beyond lightweight recent history, backend/Home Assistant core modifications.
- Permission stance: app is expected to run as a trusted user.

## Further Considerations

1. Detection rule source for camera/person events should be configuration-driven (entity-id prefixes or matcher table) to avoid hardcoding one integration format.
1. Add anti-spam policy per source (cooldown by source key) so repeated alert loops do not overwhelm users.
1. If future scope requires "all Home Assistant notification intents," add optional admin-only call_service subscription behind a separate feature flag.
