import { describe, expect, it } from 'vitest';

import {
  __test__,
  tryExtractEspresenseDeviceLabelFromMqttEvent,
} from './espresenseMqttMessageParser';

describe('espresenseMqttMessageParser', () => {
  it('maps deviceId to HA entity id', () => {
    expect(__test__.normalizeDeviceIdToEntityId('phone:jeremy')).toBe(
      'device_tracker.phone_jeremy'
    );
  });

  it('extracts device id from espresense/devices topic', () => {
    expect(__test__.parseDeviceIdFromTopic('espresense/devices/phone:jeremy/music_room')).toBe(
      'phone:jeremy'
    );
  });

  it('returns undefined for espresense/devices topic with no device id', () => {
    expect(__test__.parseDeviceIdFromTopic('espresense/devices/')).toBeUndefined();
  });

  it('returns null for non-espresense topics', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'homeassistant/sensor/foo',
        payload: '{"id":"phone:jeremy","name":"Jeremy"}',
      })
    ).toBeNull();
  });

  it('returns null for non-object event data or missing topic', () => {
    expect(tryExtractEspresenseDeviceLabelFromMqttEvent(null)).toBeNull();
    expect(tryExtractEspresenseDeviceLabelFromMqttEvent(123)).toBeNull();
    expect(tryExtractEspresenseDeviceLabelFromMqttEvent({ payload: '{}' })).toBeNull();
    expect(tryExtractEspresenseDeviceLabelFromMqttEvent({ topic: 123, payload: '{}' })).toBeNull();
  });

  it('extracts name/id from mqtt event payload', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: '{"id":"phone:jeremy","name":"Jeremy"}',
      })
    ).toEqual({
      entityId: 'device_tracker.phone_jeremy',
      name: 'Jeremy',
      alias: 'phone:jeremy',
    });
  });

  it('uses payload object directly when payload is already an object', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: { id: 'phone:jeremy', name: 'Jeremy' },
      })
    ).toEqual({
      entityId: 'device_tracker.phone_jeremy',
      name: 'Jeremy',
      alias: 'phone:jeremy',
    });
  });

  it('prefers device id from payload when provided (even if topic differs)', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: '{"id":"irk:abc","name":"Jeremy"}',
      })
    ).toEqual({
      entityId: 'device_tracker.irk_abc',
      name: 'Jeremy',
      alias: 'irk:abc',
    });
  });

  it('treats non-object JSON payload as unparseable and falls back to topic device id', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: '[]',
      })
    ).toEqual({
      entityId: 'device_tracker.phone_jeremy',
      name: undefined,
      alias: 'phone:jeremy',
    });
  });

  it('ignores non-string name in payload', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: '{"id":"phone:jeremy","name":123}',
      })
    ).toEqual({
      entityId: 'device_tracker.phone_jeremy',
      name: undefined,
      alias: 'phone:jeremy',
    });
  });

  it('falls back to deviceId from topic when payload is not parseable', () => {
    expect(
      tryExtractEspresenseDeviceLabelFromMqttEvent({
        topic: 'espresense/devices/phone:jeremy/music_room',
        payload: 'not-json',
      })
    ).toEqual({
      entityId: 'device_tracker.phone_jeremy',
      name: undefined,
      alias: 'phone:jeremy',
    });
  });
});
