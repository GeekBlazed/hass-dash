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
    // Keep App tests deterministic regardless of local .env settings.
    vi.stubEnv('VITE_FEATURE_COMPONENT_SHOWCASE', 'false');
    vi.stubEnv('VITE_FEATURE_DEBUG_PANEL', 'false');
  });

  afterEach(() => {
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
    expect(screen.getByRole('button', { name: /Lighting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Climate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agenda/i })).toBeInTheDocument();
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

  it('renders the component showcase when enabled', async () => {
    vi.stubEnv('VITE_FEATURE_COMPONENT_SHOWCASE', 'true');

    await renderAndSettle(<App />);

    expect(screen.getByRole('heading', { name: /component showcase/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('application', { name: /floorplan dashboard/i })
    ).not.toBeInTheDocument();
  });

  it('renders the debug panel when debug flag is enabled as a boolean env value', async () => {
    // Exercise the boolean env branch in App.tsx (not just the string-based path).
    vi.stubEnv('VITE_FEATURE_DEBUG_PANEL', true as unknown as string);

    await renderAndSettle(<App />);

    expect(screen.getByRole('heading', { name: /feature flags/i })).toBeInTheDocument();
  });
});
