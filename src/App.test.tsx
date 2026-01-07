import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    // Keep App tests deterministic regardless of local .env settings.
    vi.stubEnv('VITE_FEATURE_COMPONENT_SHOWCASE', 'false');
    vi.stubEnv('VITE_FEATURE_DEBUG_PANEL', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the dashboard', () => {
    render(<App />);

    // Dashboard renders the prototype-style application shell
    expect(screen.getByRole('application', { name: /floorplan prototype/i })).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    render(<App />);

    // Quick action buttons should be present
    expect(screen.getByRole('button', { name: /Lighting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Climate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agenda/i })).toBeInTheDocument();
  });

  it('renders weather display', () => {
    render(<App />);

    // Weather block should include humidity line
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(<App />);

    // Should have main and aside landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('has accessible buttons with proper roles', () => {
    render(<App />);

    // All buttons should be accessible
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // quick actions at minimum

    // Each button should be focusable
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
