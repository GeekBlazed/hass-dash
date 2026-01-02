import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the dashboard', () => {
    render(<App />);

    // Dashboard should display the Home heading
    expect(screen.getByRole('heading', { name: /Home/i })).toBeInTheDocument();
    // Dashboard should show "Welcome back" subheading
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    render(<App />);

    // Quick action buttons should be present
    expect(screen.getByRole('button', { name: /All Off/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bright/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Warm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scenes/i })).toBeInTheDocument();
  });

  it('renders room cards', () => {
    render(<App />);

    // Room cards should be present
    expect(screen.getByText(/Living Room/i)).toBeInTheDocument();
    expect(screen.getByText(/Kitchen/i)).toBeInTheDocument();
    expect(screen.getByText(/Bedroom/i)).toBeInTheDocument();
    expect(screen.getByText(/Office/i)).toBeInTheDocument();
    expect(screen.getByText(/Bathroom/i)).toBeInTheDocument();
    expect(screen.getByText(/Garage/i)).toBeInTheDocument();
  });

  it('renders weather display', () => {
    render(<App />);

    // Weather should show temperature (4.8°C)
    expect(screen.getByText(/4\.8°C/i)).toBeInTheDocument();
  });

  it('renders dashboard stats', () => {
    render(<App />);

    // Stats footer should be present
    expect(screen.getByText(/6 Rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/12 Devices/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Active/i)).toBeInTheDocument();
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
    expect(buttons.length).toBeGreaterThanOrEqual(10); // 4 actions + 6 rooms

    // Each button should be focusable
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
