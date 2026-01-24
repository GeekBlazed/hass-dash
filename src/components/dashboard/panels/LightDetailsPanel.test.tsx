import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import type { ILightService } from '../../../interfaces/ILightService';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { LightDetailsPanel } from './LightDetailsPanel';

const makeLight = (
  entityId: string,
  attributes: Record<string, unknown>
): HaEntityState<Record<string, unknown>> => {
  return {
    entity_id: entityId,
    state: 'on',
    attributes,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('LightDetailsPanel', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Prevent leaked fake timers from hanging subsequent hooks.
    vi.useRealTimers();
  });

  it('calls setBrightness when the slider changes', async () => {
    vi.useFakeTimers();

    useEntityStore.getState().upsert(
      makeLight('light.kitchen', {
        friendly_name: 'Kitchen',
        supported_color_modes: ['brightness'],
        brightness: 100,
      })
    );

    const setBrightness = vi.fn().mockResolvedValue(undefined);
    const mockService: Partial<ILightService> = {
      turnOn: vi.fn(),
      turnOff: vi.fn(),
      setBrightness,
      setColorTemperature: vi.fn(),
      setRgbColor: vi.fn(),
    };

    const getSpy = vi.spyOn(container, 'get').mockReturnValue(mockService as ILightService);

    render(
      <LightDetailsPanel
        entityId="light.kitchen"
        onBack={() => {
          return;
        }}
      />
    );

    const slider = screen
      .getByLabelText('Brightness')
      .querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(slider).not.toBeNull();

    fireEvent.input(slider!, { target: { value: '200' } });

    expect(setBrightness).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(900);
    expect(setBrightness).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(setBrightness).toHaveBeenCalledWith('light.kitchen', 200);

    getSpy.mockRestore();
  });

  it('debounces brightness changes while dragging', async () => {
    vi.useFakeTimers();

    useEntityStore.getState().upsert(
      makeLight('light.kitchen', {
        friendly_name: 'Kitchen',
        supported_color_modes: ['brightness'],
        brightness: 100,
      })
    );

    const setBrightness = vi.fn().mockResolvedValue(undefined);
    const mockService: Partial<ILightService> = {
      turnOn: vi.fn(),
      turnOff: vi.fn(),
      setBrightness,
      setColorTemperature: vi.fn(),
      setRgbColor: vi.fn(),
    };

    const getSpy = vi.spyOn(container, 'get').mockReturnValue(mockService as ILightService);

    render(
      <LightDetailsPanel
        entityId="light.kitchen"
        onBack={() => {
          return;
        }}
      />
    );

    const slider = screen
      .getByLabelText('Brightness')
      .querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(slider).not.toBeNull();

    fireEvent.input(slider!, { target: { value: '120' } });
    await vi.advanceTimersByTimeAsync(500);
    fireEvent.input(slider!, { target: { value: '180' } });

    expect(setBrightness).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(900);
    expect(setBrightness).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);

    expect(setBrightness).toHaveBeenCalledTimes(1);
    expect(setBrightness).toHaveBeenCalledWith('light.kitchen', 180);

    getSpy.mockRestore();
  });

  it('calls setColorTemperature when color temperature changes', async () => {
    vi.useFakeTimers();

    useEntityStore.getState().upsert(
      makeLight('light.bedroom', {
        friendly_name: 'Bedroom',
        supported_color_modes: ['color_temp'],
        min_mireds: 153,
        max_mireds: 500,
        color_temp: 250,
      })
    );

    const setColorTemperature = vi.fn().mockResolvedValue(undefined);
    const mockService: Partial<ILightService> = {
      turnOn: vi.fn(),
      turnOff: vi.fn(),
      setBrightness: vi.fn(),
      setColorTemperature,
      setRgbColor: vi.fn(),
    };

    const getSpy = vi.spyOn(container, 'get').mockReturnValue(mockService as ILightService);

    render(
      <LightDetailsPanel
        entityId="light.bedroom"
        onBack={() => {
          return;
        }}
      />
    );

    const slider = screen
      .getByLabelText('Color temperature')
      .querySelector('input[type="range"]') as HTMLInputElement | null;

    expect(slider).not.toBeNull();

    fireEvent.input(slider!, { target: { value: '300' } });

    expect(setColorTemperature).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(setColorTemperature).toHaveBeenCalledWith('light.bedroom', 300);

    getSpy.mockRestore();
  });

  it('calls setRgbColor when the color input changes', async () => {
    useEntityStore.getState().upsert(
      makeLight('light.desk', {
        friendly_name: 'Desk',
        supported_color_modes: ['rgb'],
        rgb_color: [255, 0, 0],
      })
    );

    const setRgbColor = vi.fn().mockResolvedValue(undefined);
    const mockService: Partial<ILightService> = {
      turnOn: vi.fn(),
      turnOff: vi.fn(),
      setBrightness: vi.fn(),
      setColorTemperature: vi.fn(),
      setRgbColor,
    };

    const getSpy = vi.spyOn(container, 'get').mockReturnValue(mockService as ILightService);

    render(
      <LightDetailsPanel
        entityId="light.desk"
        onBack={() => {
          return;
        }}
      />
    );

    const input = document.querySelector('input[type="color"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { value: '#00ff00' } });

    expect(setRgbColor).toHaveBeenCalledWith('light.desk', [0, 255, 0]);

    getSpy.mockRestore();
  });
});
