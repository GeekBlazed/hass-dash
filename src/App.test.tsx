import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

async function renderAndSettle(ui: ReactElement): Promise<void> {
  render(ui);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.removeItem('hass-dash:devtools');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.removeItem('hass-dash:devtools');
    vi.unstubAllEnvs();
  });

  it('renders the dashboard', async () => {
    await renderAndSettle(<App />);

    // Dashboard renders the application shell
    expect(screen.getByRole('application', { name: /floorplan dashboard/i })).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    await renderAndSettle(<App />);

    // Quick action buttons should be present
    expect(screen.getByRole('button', { name: /^lighting$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^climate$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^media$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agenda$/i })).toBeInTheDocument();
  });

  it('renders weather display', async () => {
    await renderAndSettle(<App />);

    // Weather block should include humidity line
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('has proper semantic structure', async () => {
    await renderAndSettle(<App />);

    // Should have main and aside landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('has accessible buttons with proper roles', async () => {
    await renderAndSettle(<App />);

    // All buttons should be accessible
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // quick actions at minimum

    // Each button should be focusable
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  it('does not render the debug panel by default', async () => {
    await renderAndSettle(<App />);
    expect(screen.queryByRole('heading', { name: /dev tools/i })).not.toBeInTheDocument();
  });

  it('renders the debug panel when ?debug is present', async () => {
    window.history.replaceState({}, '', '/?debug');
    await renderAndSettle(<App />);
    expect(screen.getByRole('heading', { name: /dev tools/i })).toBeInTheDocument();
  });
});
