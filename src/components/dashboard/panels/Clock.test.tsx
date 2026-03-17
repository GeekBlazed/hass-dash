import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntityStore } from '../../../stores/useEntityStore';
import { Clock } from './Clock';

const TEST_DATETIME = new Date(2026, 0, 3, 3, 5, 2).getTime();
const TEST_DATETIME_ODD_SECONDS = new Date(2026, 0, 3, 3, 5, 1).getTime();

describe('Clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEntityStore.getState().clear();
  });

  afterEach(() => {
    useEntityStore.getState().clear();
    vi.useRealTimers();
  });

  it('renders 12-hour time with AM and outline icon during night hours', () => {
    vi.setSystemTime(TEST_DATETIME);

    const { container } = render(<Clock />);

    expect(screen.getByLabelText('Clock')).toBeInTheDocument();
    expect(container.querySelector('.clock-time')?.textContent).toContain('3:05 AM');
    expect(screen.getByTestId('clock-icon')).toHaveAttribute(
      'data-icon',
      'mdi:clock-time-three-outline'
    );
  });

  it('hides divider on odd seconds', () => {
    vi.setSystemTime(TEST_DATETIME_ODD_SECONDS);

    const { container } = render(<Clock />);

    const divider = container.querySelector('.clock-divider');
    expect(divider).toHaveClass('clock-divider--off');
  });

  it('seeds from sensor.time HH:MM', async () => {
    vi.setSystemTime(new Date(2026, 0, 3, 0, 0, 0));

    useEntityStore.getState().setAll([
      {
        entity_id: 'sensor.time',
        state: '07:08',
        attributes: {},
        last_changed: TEST_DATETIME.toString(),
        last_updated: TEST_DATETIME.toString(),
        context: {
          id: 'ctx-sensor-time',
          parent_id: null,
          user_id: null,
        },
      },
    ]);

    const { container } = render(<Clock />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.clock-time')?.textContent).toContain('7:08 AM');
    expect(screen.getByTestId('clock-icon')).toHaveAttribute('data-icon', 'mdi:clock-time-seven');
  });
});
