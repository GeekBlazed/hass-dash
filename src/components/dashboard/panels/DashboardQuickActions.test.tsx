import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { DashboardQuickActions } from './DashboardQuickActions';

describe('DashboardQuickActions', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      activePanel: 'climate',
      overlays: { tracking: true, climate: true, lighting: false },
    });
  });

  it('opens lighting and toggles overlays (lighting on, climate off)', () => {
    render(<DashboardQuickActions />);

    fireEvent.click(screen.getByRole('button', { name: /^lighting$/i }));

    const state = useDashboardStore.getState();
    expect(state.activePanel).toBe('lighting');
    expect(state.overlays.lighting).toBe(true);
    expect(state.overlays.climate).toBe(false);
  });

  it('closes lighting and restores climate overlay', () => {
    useDashboardStore.setState({
      activePanel: 'lighting',
      overlays: { tracking: true, climate: false, lighting: true },
    });

    render(<DashboardQuickActions />);

    fireEvent.click(screen.getByRole('button', { name: /^lighting$/i }));

    const state = useDashboardStore.getState();
    expect(state.activePanel).toBe(null);
    expect(state.overlays.lighting).toBe(false);
    expect(state.overlays.climate).toBe(true);
  });

  it('switches to climate and forces climate overlay on', () => {
    useDashboardStore.setState({
      activePanel: 'lighting',
      overlays: { tracking: true, climate: false, lighting: true },
    });

    render(<DashboardQuickActions />);

    fireEvent.click(screen.getByRole('button', { name: /^climate$/i }));

    const state = useDashboardStore.getState();
    expect(state.activePanel).toBe('climate');
    expect(state.overlays.lighting).toBe(false);
    expect(state.overlays.climate).toBe(true);
  });
});
