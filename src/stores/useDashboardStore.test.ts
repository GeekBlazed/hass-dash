import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from './useDashboardStore';

const createInitialDashboardState = () => ({
  activePanel: 'climate' as const,
  stageView: { x: 0, y: 0, scale: 1 },
  lighting: { lights: {} },
  climate: { thermostat: {}, areas: {} },
});

const resetDashboardStore = () => {
  useDashboardStore.persist.clearStorage();
  useDashboardStore.setState(createInitialDashboardState());
};

describe('useDashboardStore', () => {
  beforeEach(() => {
    resetDashboardStore();
  });

  it('defaults to climate panel', () => {
    expect(useDashboardStore.getState().activePanel).toBe('climate');
  });

  it('can set active panel', () => {
    useDashboardStore.getState().setActivePanel('lighting');
    expect(useDashboardStore.getState().activePanel).toBe('lighting');
  });

  it('can update stage view partially', () => {
    useDashboardStore.getState().setStageView({ scale: 2 });
    expect(useDashboardStore.getState().stageView).toEqual({ x: 0, y: 0, scale: 2 });
  });

  it('can reset stage view', () => {
    useDashboardStore.getState().setStageView({ x: 12, y: 34, scale: 1.5 });
    useDashboardStore.getState().resetStageView();

    expect(useDashboardStore.getState().stageView).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('can set local lighting state (partial updates)', () => {
    useDashboardStore.getState().setLightState('light.kitchen', { name: 'Kitchen', state: 'on' });
    useDashboardStore.getState().setLightState('light.kitchen', { brightness: 123 });

    expect(useDashboardStore.getState().lighting.lights['light.kitchen']).toEqual({
      id: 'light.kitchen',
      name: 'Kitchen',
      state: 'on',
      brightness: 123,
    });
  });

  it('can toggle local light on/off', () => {
    useDashboardStore.getState().setLightOn('light.family_room', true);
    expect(useDashboardStore.getState().lighting.lights['light.family_room']?.state).toBe('on');

    useDashboardStore.getState().setLightOn('light.family_room', false);
    expect(useDashboardStore.getState().lighting.lights['light.family_room']?.state).toBe('off');
  });

  it('preserves existing light properties when toggling state', () => {
    useDashboardStore.getState().setLightState('light.dining', {
      name: 'Dining',
      brightness: 200,
      colorTemp: 3500,
    });
    useDashboardStore.getState().setLightOn('light.dining', true);
    expect(useDashboardStore.getState().lighting.lights['light.dining']).toEqual({
      id: 'light.dining',
      name: 'Dining',
      brightness: 200,
      colorTemp: 3500,
      state: 'on',
    });
    useDashboardStore.getState().setLightOn('light.dining', false);
    expect(useDashboardStore.getState().lighting.lights['light.dining']).toEqual({
      id: 'light.dining',
      name: 'Dining',
      brightness: 200,
      colorTemp: 3500,
      state: 'off',
    });
  });

  it('can clear local lighting model', () => {
    useDashboardStore.getState().setLightOn('light.studio', true);
    useDashboardStore.getState().clearLighting();

    expect(useDashboardStore.getState().lighting).toEqual({ lights: {} });
  });

  it('can set thermostat fields (partial updates)', () => {
    useDashboardStore.getState().setThermostat({ setTemperature: 70, hvacMode: 'cool' });
    useDashboardStore.getState().setThermostat({ fanMode: 'auto' });

    expect(useDashboardStore.getState().climate.thermostat).toEqual({
      setTemperature: 70,
      hvacMode: 'cool',
      fanMode: 'auto',
    });
  });

  it('can set area climate (partial updates)', () => {
    useDashboardStore.getState().setAreaClimate('kitchen', { temp: 80, humidity: null });
    useDashboardStore.getState().setAreaClimate('kitchen', { temp: 81 });

    expect(useDashboardStore.getState().climate.areas.kitchen).toEqual({
      areaId: 'kitchen',
      temp: 81,
      humidity: null,
    });
  });

  it('can clear local climate model', () => {
    useDashboardStore.getState().setThermostat({ setTemperature: 72 });
    useDashboardStore.getState().setAreaClimate('office', { temp: 76 });
    useDashboardStore.getState().clearClimate();

    expect(useDashboardStore.getState().climate).toEqual({ thermostat: {}, areas: {} });
  });
});
