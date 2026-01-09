import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../../../types/home-assistant';

import {
  extractDeviceLocationUpdateFromHaEntityState,
  extractDeviceLocationUpdatesFromJsonPayload,
} from './espresenseLocationExtractor';

describe('espresenseLocationExtractor', () => {
  it('extracts update from a valid HaEntityState (x/y/z/confidence/last_seen) when confidence > minConfidence', () => {
    const entityState: HaEntityState = {
      entity_id: 'device_tracker.phone_jeremy',
      state: 'not_home',
      attributes: {
        x: 2.7473150322009507,
        y: 1.9257382372352163,
        z: 0.9015358659193731,
        confidence: 74,
        last_seen: '2026-01-07T09:15:53.7063821Z',
      },
      last_changed: '2026-01-07T09:15:54Z',
      last_updated: '2026-01-07T09:15:54Z',
      context: { id: 'abc', parent_id: null, user_id: null },
    };

    const updates = extractDeviceLocationUpdateFromHaEntityState(entityState, 69, 123456);

    expect(updates).toEqual([
      {
        entityId: 'device_tracker.phone_jeremy',
        position: {
          x: 2.7473150322009507,
          y: 1.9257382372352163,
          z: 0.9015358659193731,
        },
        confidence: 74,
        lastSeen: '2026-01-07T09:15:53.7063821Z',
        receivedAt: 123456,
      },
    ]);
  });

  it('returns zero updates for invalid JSON', () => {
    const updates = extractDeviceLocationUpdatesFromJsonPayload('{nope', 69, 1);
    expect(updates).toEqual([]);
  });

  it('returns zero updates when required fields are missing', () => {
    const entityStateMissing: HaEntityState = {
      entity_id: 'device_tracker.phone_jeremy',
      state: 'not_home',
      attributes: {
        x: 1,
        // y missing
        confidence: 99,
      },
      last_changed: '2026-01-07T09:15:54Z',
      last_updated: '2026-01-07T09:15:54Z',
      context: { id: 'abc', parent_id: null, user_id: null },
    };

    expect(extractDeviceLocationUpdateFromHaEntityState(entityStateMissing, 69, 1)).toEqual([]);

    const jsonMissing = JSON.stringify({
      type: 'event',
      event: {
        c: {
          'device_tracker.phone_jeremy': {
            '+': {
              a: { x: 1, confidence: 99 },
            },
          },
        },
      },
      id: 3,
    });

    expect(extractDeviceLocationUpdatesFromJsonPayload(jsonMissing, 69, 1)).toEqual([]);
  });

  it('rejects update when confidence <= minConfidence and accepts when confidence > minConfidence', () => {
    const baseState: HaEntityState = {
      entity_id: 'device_tracker.phone_jeremy',
      state: 'not_home',
      attributes: {
        x: 1,
        y: 2,
        confidence: 69,
      },
      last_changed: '2026-01-07T09:15:54Z',
      last_updated: '2026-01-07T09:15:54Z',
      context: { id: 'abc', parent_id: null, user_id: null },
    };

    expect(extractDeviceLocationUpdateFromHaEntityState(baseState, 69, 1)).toEqual([]);

    const accepted: HaEntityState = {
      ...baseState,
      attributes: {
        x: 1,
        y: 2,
        confidence: 70,
      },
    };

    expect(extractDeviceLocationUpdateFromHaEntityState(accepted, 69, 1)).toEqual([
      {
        entityId: 'device_tracker.phone_jeremy',
        position: { x: 1, y: 2 },
        confidence: 70,
        lastSeen: undefined,
        receivedAt: 1,
      },
    ]);
  });
});
