import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickActions } from './QuickActions';

describe('QuickActions', () => {
  it('renders the default actions', () => {
    render(<QuickActions />);

    expect(screen.getByRole('button', { name: 'All Off' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bright' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scenes' })).toBeInTheDocument();
  });

  it('calls onAction with the action id when clicked', () => {
    const onAction = vi.fn();
    render(<QuickActions onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'All Off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bright' }));
    fireEvent.click(screen.getByRole('button', { name: 'Warm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Scenes' }));

    expect(onAction).toHaveBeenCalledWith('all-off');
    expect(onAction).toHaveBeenCalledWith('bright');
    expect(onAction).toHaveBeenCalledWith('warm');
    expect(onAction).toHaveBeenCalledWith('scenes');
  });

  it('does not throw when clicked without onAction handler', () => {
    render(<QuickActions />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'All Off' }))).not.toThrow();
  });

  it('applies active styling to the warm action', () => {
    render(<QuickActions />);

    const warmButton = screen.getByRole('button', { name: 'Warm' });
    const brightButton = screen.getByRole('button', { name: 'Bright' });

    expect(warmButton.className).toContain('bg-accent/10');
    expect(brightButton.className).toContain('bg-panel-card');
  });
});
