import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoFloorPlan } from './DemoFloorPlan';

describe('DemoFloorPlan', () => {
  it('renders all rooms and legend', () => {
    render(<DemoFloorPlan />);

    expect(screen.getByText('Floor Plan Preview')).toBeInTheDocument();
    expect(screen.getByText('Living Room')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Lights On')).toBeInTheDocument();
    expect(screen.getByText('Lights Off')).toBeInTheDocument();
  });

  it('toggles room light state when room group is clicked', () => {
    render(<DemoFloorPlan />);

    expect(screen.getAllByText('Lights OFF').length).toBeGreaterThan(0);

    const kitchenLabel = screen.getByText('Kitchen');
    const roomGroup = kitchenLabel.closest('g');
    expect(roomGroup).not.toBeNull();

    fireEvent.click(roomGroup as SVGGElement);

    const statuses = screen.getAllByText(/Lights (ON|OFF)/);
    expect(statuses.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lights ON').length).toBeGreaterThanOrEqual(3);
  });
});
