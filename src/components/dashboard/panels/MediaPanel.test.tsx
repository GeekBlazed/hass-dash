import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MediaPanel } from './MediaPanel';

describe('MediaPanel', () => {
  it('is hidden by default', () => {
    render(<MediaPanel />);
    const root = screen.getByLabelText('Media player');
    expect(root).toHaveClass('tile');
    expect(root).toHaveClass('media-window');
    expect(root).toHaveClass('is-hidden');
  });

  it('is visible when isHidden=false', () => {
    render(<MediaPanel isHidden={false} />);
    const root = screen.getByLabelText('Media player');
    expect(root).toHaveClass('tile');
    expect(root).toHaveClass('media-window');
    expect(root).not.toHaveClass('is-hidden');
  });
});
