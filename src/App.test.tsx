import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the welcome screen', () => {
    render(<App />);

    expect(screen.getByText(/Home Assistant Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Your smart home, visualized/i)).toBeInTheDocument();
  });

  it('displays the version from environment variable', () => {
    render(<App />);

    const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
    expect(screen.getByText(new RegExp(`hass-dash v${version}`, 'i'))).toBeInTheDocument();
  });

  it('displays default version when env variable is not set', () => {
    // Store original value
    const originalEnv = import.meta.env.VITE_APP_VERSION;

    // Temporarily unset the env variable
    vi.stubEnv('VITE_APP_VERSION', undefined);

    render(<App />);

    expect(screen.getByText(/hass-dash v0\.1\.0/i)).toBeInTheDocument();

    // Restore original value
    if (originalEnv !== undefined) {
      vi.stubEnv('VITE_APP_VERSION', originalEnv);
    } else {
      vi.unstubAllEnvs();
    }
  });

  it('shows development mode indicator', () => {
    render(<App />);

    expect(screen.getByText(/Development Mode/i)).toBeInTheDocument();
  });

  it('renders documentation and GitHub links', () => {
    render(<App />);

    const docLink = screen.getByRole('link', { name: /Documentation/i });
    const githubLink = screen.getByRole('link', { name: /GitHub/i });

    expect(docLink).toBeInTheDocument();
    expect(docLink).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', expect.stringContaining('github.com'));
  });

  it('has proper accessibility attributes on interactive elements', () => {
    render(<App />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('href');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('displays the developer tools hint', () => {
    render(<App />);

    expect(screen.getByText(/Press/i)).toBeInTheDocument();
    expect(screen.getByText(/F12/i)).toBeInTheDocument();
  });
});
