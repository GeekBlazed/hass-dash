import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { container } from '../../core/di-container';
import type { IHomeAssistantClient } from '../../interfaces/IHomeAssistantClient';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';

describe('HaLightHotwireBridge', () => {
  it('calls Home Assistant light.toggle for the NORAD entity', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = {
      connect,
      callService,
    };

    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaLightHotwireBridge />);

    window.dispatchEvent(
      new CustomEvent('hass-dash:toggle-light', {
        detail: { entityId: 'light.norad_corner_torch' },
      })
    );

    // Allow the async handler to flush.
    await Promise.resolve();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'toggle',
      service_data: { entity_id: 'light.norad_corner_torch' },
    });

    getSpy.mockRestore();
  });

  it('ignores non-NORAD entities', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = {
      connect,
      callService,
    };

    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaLightHotwireBridge />);

    window.dispatchEvent(
      new CustomEvent('hass-dash:toggle-light', {
        detail: { entityId: 'light.some_other_light' },
      })
    );

    await Promise.resolve();

    expect(connect).not.toHaveBeenCalled();
    expect(callService).not.toHaveBeenCalled();

    getSpy.mockRestore();
  });
});
