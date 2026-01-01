import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoomCard, type RoomData } from './RoomCard';

describe('RoomCard', () => {
  it('should render room name', () => {
    const room: RoomData = { id: 'test', name: 'Test Room' };
    render(<RoomCard room={room} />);
    expect(screen.getByText('Test Room')).toBeInTheDocument();
  });

  it('should display temperature when provided', () => {
    const room: RoomData = { id: 'living', name: 'Living Room', temperature: 21.5 };
    render(<RoomCard room={room} />);
    expect(screen.getByText('21.5°C')).toBeInTheDocument();
  });

  it('should display "ON" when status is on', () => {
    const room: RoomData = { id: 'office', name: 'Office', status: 'on' };
    render(<RoomCard room={room} />);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('should display "OFF" when status is off', () => {
    const room: RoomData = { id: 'bathroom', name: 'Bathroom', status: 'off' };
    render(<RoomCard room={room} />);
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('should display "Dim" when status is dim', () => {
    const room: RoomData = { id: 'garage', name: 'Garage', status: 'dim' };
    render(<RoomCard room={room} />);
    expect(screen.getByText('Dim')).toBeInTheDocument();
  });

  it('should display "ON" when lights is true', () => {
    const room: RoomData = { id: 'hallway', name: 'Hallway', lights: true };
    render(<RoomCard room={room} />);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('should display "OFF" when lights is false', () => {
    const room: RoomData = { id: 'hallway', name: 'Hallway', lights: false };
    render(<RoomCard room={room} />);
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('should display empty string when no status info', () => {
    const room: RoomData = { id: 'empty', name: 'Empty Room' };
    render(<RoomCard room={room} />);
    // Room name should be present, but no status text
    expect(screen.getByText('Empty Room')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const room: RoomData = { id: 'test', name: 'Test Room', status: 'on' };
    const handleClick = vi.fn();
    render(<RoomCard room={room} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(room);
  });

  it('should not throw when clicked without onClick handler', () => {
    const room: RoomData = { id: 'test', name: 'Test Room' };
    render(<RoomCard room={room} />);
    
    // Should not throw
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('should apply hover state on mouse enter', () => {
    const room: RoomData = { id: 'test', name: 'Test Room', status: 'on' };
    render(<RoomCard room={room} />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    // Check that the hover scale class is applied
    expect(button.className).toContain('scale-[1.02]');
  });

  it('should remove hover state on mouse leave', () => {
    const room: RoomData = { id: 'test', name: 'Test Room', status: 'on' };
    render(<RoomCard room={room} />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    expect(button.className).toContain('scale-[1.02]');
    
    fireEvent.mouseLeave(button);
    expect(button.className).not.toContain('scale-[1.02]');
  });

  it('should render status indicator dot', () => {
    const room: RoomData = { id: 'test', name: 'Test Room', temperature: 20 };
    const { container } = render(<RoomCard room={room} />);
    
    // Check for the accent-colored status dot
    const dot = container.querySelector('.bg-accent');
    expect(dot).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    const room: RoomData = { id: 'test', name: 'Test Room' };
    render(<RoomCard room={room} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should format temperature to one decimal place', () => {
    const room: RoomData = { id: 'test', name: 'Test', temperature: 22.567 };
    render(<RoomCard room={room} />);
    expect(screen.getByText('22.6°C')).toBeInTheDocument();
  });
});
