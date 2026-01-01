import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('should render the home heading', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: /home/i })).toBeInTheDocument();
  });

  it('should render the welcome message', () => {
    render(<Dashboard />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText(/your home at a glance/i)).toBeInTheDocument();
  });

  it('should render all six room cards', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kitchen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bedroom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /office/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bathroom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /garage/i })).toBeInTheDocument();
  });

  it('should render weather display', () => {
    render(<Dashboard />);
    expect(screen.getByText(/4\.8°C/)).toBeInTheDocument();
    expect(screen.getByText(/breezy and foggy/i)).toBeInTheDocument();
  });

  it('should render quick action buttons', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /all off/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bright/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /warm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scenes/i })).toBeInTheDocument();
  });

  it('should render bottom stats', () => {
    render(<Dashboard />);
    expect(screen.getByText(/6 rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/12 devices/i)).toBeInTheDocument();
    expect(screen.getByText(/3 active/i)).toBeInTheDocument();
  });

  it('should toggle room status when clicked', () => {
    render(<Dashboard />);
    
    // Office starts with status 'on' showing 'ON'
    const officeCard = screen.getByRole('button', { name: /office/i });
    expect(screen.getByText('ON')).toBeInTheDocument();
    
    // Click to toggle from on -> dim
    fireEvent.click(officeCard);
    // Now there should be 2 "Dim" texts (office and garage)
    const dimTexts = screen.getAllByText('Dim');
    expect(dimTexts.length).toBe(2);
    
    // Click again to toggle from dim -> off
    fireEvent.click(officeCard);
    // Should now have more OFF texts (bathroom + office)
    const offTexts = screen.getAllByText('OFF');
    expect(offTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('should not toggle temperature-only rooms', () => {
    render(<Dashboard />);
    
    // Living room has temperature, not status
    const livingRoomCard = screen.getByRole('button', { name: /living room/i });
    const tempBefore = screen.getByText(/20\.1°C/);
    expect(tempBefore).toBeInTheDocument();
    
    // Clicking should not change the temperature display
    fireEvent.click(livingRoomCard);
    expect(screen.getByText(/20\.1°C/)).toBeInTheDocument();
  });

  it('should turn all lights off when "All Off" is clicked', () => {
    render(<Dashboard />);
    
    // Initially, office is 'on', bathroom is 'off', garage is 'dim'
    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByText('Dim')).toBeInTheDocument();
    
    // Click "All Off"
    const allOffButton = screen.getByRole('button', { name: /all off/i });
    fireEvent.click(allOffButton);
    
    // All status rooms should now be 'OFF'
    const offTexts = screen.getAllByText('OFF');
    expect(offTexts.length).toBe(3); // office, bathroom, garage all OFF
  });

  it('should turn all lights on when "Bright" is clicked', () => {
    render(<Dashboard />);
    
    // Click "Bright"
    const brightButton = screen.getByRole('button', { name: /bright/i });
    fireEvent.click(brightButton);
    
    // All status rooms should now be 'ON'
    const onTexts = screen.getAllByText('ON');
    expect(onTexts.length).toBe(3); // office, bathroom, garage all ON
  });

  it('should render sidebar info', () => {
    render(<Dashboard />);
    expect(screen.getByText(/hassdash v0\.1\.0/i)).toBeInTheDocument();
  });

  it('should render humidity in weather display', () => {
    render(<Dashboard />);
    expect(screen.getByText(/47%/)).toBeInTheDocument();
  });
});
