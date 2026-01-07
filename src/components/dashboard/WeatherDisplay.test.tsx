import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherDisplay } from './WeatherDisplay';

describe('WeatherDisplay', () => {
  it('renders temperature and condition', () => {
    render(<WeatherDisplay temperature={21.234} condition="Rain" />);

    expect(screen.getByText('21.2°C')).toBeInTheDocument();
    expect(screen.getByText('Rain')).toBeInTheDocument();
  });

  it('renders humidity when provided', () => {
    render(<WeatherDisplay temperature={20} condition="Cloudy" humidity={55} />);

    expect(screen.getByText('humidity: 55%')).toBeInTheDocument();
  });

  it('does not render humidity when omitted', () => {
    render(<WeatherDisplay temperature={20} condition="Cloudy" />);

    expect(screen.queryByText(/humidity:/i)).not.toBeInTheDocument();
  });
});
