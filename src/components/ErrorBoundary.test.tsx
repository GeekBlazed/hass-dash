import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function AlwaysThrows(): JSX.Element {
  throw new Error('Boom');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>OK</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders a retry UI when child throws, and can recover on retry', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [shouldThrow, setShouldThrow] = useState(true);

      return (
        <ErrorBoundary onRetry={() => setShouldThrow(false)}>
          {shouldThrow ? <AlwaysThrows /> : <div>Recovered</div>}
        </ErrorBoundary>
      );
    }

    render(<Harness />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
