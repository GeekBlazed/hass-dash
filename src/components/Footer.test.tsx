import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('should render app name and version', () => {
    render(<Footer />);
    expect(screen.getByText(/HassDash/)).toBeInTheDocument();
    expect(screen.getByText(/v0.1.0/)).toBeInTheDocument();
  });

  it('should render GitHub link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'GitHub' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/GeekBlazed/hass-dash');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should render Documentation link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/GeekBlazed/hass-dash/blob/main/README.md'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should render MIT License link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'MIT License' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/GeekBlazed/hass-dash/blob/main/LICENSE'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should have proper link accessibility attributes', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    
    links.forEach((link) => {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
