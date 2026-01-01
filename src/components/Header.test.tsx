import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';
import { userEvent } from '@testing-library/user-event';

describe('Header', () => {
  it('should render app title', () => {
    render(<Header />);
    expect(screen.getByText('HassDash')).toBeInTheDocument();
    expect(screen.getByText('Smart Home Dashboard')).toBeInTheDocument();
  });

  it('should render home icon', () => {
    render(<Header />);
    const icon = screen.getByRole('img', { name: 'Home' });
    expect(icon).toBeInTheDocument();
  });

  it('should render theme toggle button', () => {
    render(<Header />);
    const button = screen.getByLabelText(/switch to (light|dark) mode/i);
    expect(button).toBeInTheDocument();
  });

  it('should toggle theme when button clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);
    
    const button = screen.getByRole('button', { name: /switch to/i });
    await user.click(button);
    
    // Verify localStorage.setItem was called
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should render menu button when onMenuClick provided', () => {
    const handleMenuClick = () => {};
    render(<Header onMenuClick={handleMenuClick} />);
    
    const menuButton = screen.getByLabelText('Open menu');
    expect(menuButton).toBeInTheDocument();
  });

  it('should not render menu button when onMenuClick not provided', () => {
    render(<Header />);
    
    const menuButton = screen.queryByLabelText('Open menu');
    expect(menuButton).not.toBeInTheDocument();
  });

  it('should call onMenuClick when menu button clicked', async () => {
    const user = userEvent.setup();
    let clicked = false;
    const handleMenuClick = () => { clicked = true; };
    
    render(<Header onMenuClick={handleMenuClick} />);
    
    const menuButton = screen.getByLabelText('Open menu');
    await user.click(menuButton);
    
    expect(clicked).toBe(true);
  });

  it('should respect system dark mode preference on initial render', () => {
    // Mock matchMedia to return dark mode preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    });

    render(<Header />);
    
    // Should render sun icon (for switching to light mode)
    const button = screen.getByLabelText('Switch to light mode');
    expect(button).toBeInTheDocument();
  });

  it('should load theme from localStorage if available', () => {
    localStorage.setItem('theme', 'dark');
    
    render(<Header />);
    
    const button = screen.getByLabelText('Switch to light mode');
    expect(button).toBeInTheDocument();
    
    // Cleanup
    localStorage.removeItem('theme');
  });
});
