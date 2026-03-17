import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoDevices } from './DemoDevices';

describe('DemoDevices', () => {
  it('renders sensors as active and does not render a toggle button for sensors', () => {
    render(<DemoDevices />);

    expect(screen.getByText('Motion Sensor')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /motion sensor/i })).not.toBeInTheDocument();
  });

  it('toggles non-sensor devices on click', () => {
    render(<DemoDevices />);

    const onButton = screen.getAllByRole('button', { name: 'ON' })[0];
    expect(onButton).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'ON' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'OFF' })).toHaveLength(2);

    fireEvent.click(onButton);

    expect(screen.getAllByRole('button', { name: 'ON' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'OFF' })).toHaveLength(3);
  });
});
