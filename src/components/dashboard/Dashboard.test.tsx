import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('should render the floorplan application shell', () => {
    render(<Dashboard />);
    expect(screen.getByRole('application', { name: /floorplan prototype/i })).toBeInTheDocument();
  });

  it('should render the sidebar brand and weather summary', () => {
    render(<Dashboard />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText(/weather summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('should render quick action buttons', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /lighting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /climate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument();
  });

  it('should render the climate panel thermostat values', () => {
    render(<Dashboard />);
    expect(screen.getByLabelText(/climate controls/i)).toBeInTheDocument();
    expect(screen.getByText(/71°F/i)).toBeInTheDocument();
    expect(screen.getByText(/47%/i)).toBeInTheDocument();
  });

  it('should render the floorplan stage and svg container', () => {
    render(<Dashboard />);
    expect(screen.getByRole('main', { name: /floorplan/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /home floorplan \(from yaml\)/i })).toBeInTheDocument();
  });

  it('should include a floorplan empty state container', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: /floorplan not loaded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
