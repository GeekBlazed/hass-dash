import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapControlsToggle } from './MapControlsToggle';

describe('MapControlsToggle', () => {
  it('is visible when closed and hidden when open', () => {
    const { rerender } = render(<MapControlsToggle />);

    const btn = screen.getByRole('button', { name: 'Show map controls' });
    expect(btn.getAttribute('class') ?? '').not.toContain('is-hidden');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    rerender(<MapControlsToggle isOpen={true} />);
    expect(btn.getAttribute('class') ?? '').toContain('is-hidden');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();

    render(<MapControlsToggle isOpen={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show map controls' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
