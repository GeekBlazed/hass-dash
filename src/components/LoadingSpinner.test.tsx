import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders a status element with label', () => {
    render(<LoadingSpinner label="Loading data" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading data/i)).toBeInTheDocument();
  });
});
