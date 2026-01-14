import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgendaPanel } from './AgendaPanel';

describe('AgendaPanel', () => {
  it('is hidden by default', () => {
    render(<AgendaPanel />);
    const root = screen.getByLabelText('Agenda');
    expect(root).toHaveClass('agenda');
    expect(root).toHaveClass('is-hidden');
  });

  it('is visible when isHidden=false', () => {
    render(<AgendaPanel isHidden={false} />);
    const root = screen.getByLabelText('Agenda');
    expect(root).toHaveClass('agenda');
    expect(root).not.toHaveClass('is-hidden');
  });
});
