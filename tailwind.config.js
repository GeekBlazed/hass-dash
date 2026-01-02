/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm dark theme from SVG design
        accent: {
          DEFAULT: '#ffb65c',
          light: '#ffc97d',
          dark: '#e5a352',
        },
        panel: {
          bg: '#090909',
          'bg-warm': '#1a1713',
          surface: '#121212',
          card: '#151515',
          border: '#1f1f1f',
          'border-light': '#2a2a2a',
        },
        text: {
          primary: '#eae7df',
          secondary: '#b9b6af',
          muted: '#8a8885',
        },
        // Legacy colors for compatibility
        primary: {
          light: '#ffc97d',
          DEFAULT: '#ffb65c',
          dark: '#e5a352',
        },
        surface: {
          light: '#1a1713',
          DEFAULT: '#121212',
          dark: '#090909',
        },
        success: {
          light: '#81c784',
          DEFAULT: '#4caf50',
          dark: '#388e3c',
        },
        warning: {
          light: '#ffb74d',
          DEFAULT: '#ff9800',
          dark: '#f57c00',
        },
        danger: {
          light: '#e57373',
          DEFAULT: '#f44336',
          dark: '#d32f2f',
        },
      },
      backgroundImage: {
        'warm-gradient': 'linear-gradient(135deg, #1a1713 0%, #0e0d0b 50%, #090909 100%)',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'fade-out': 'fadeOut 150ms ease-in',
        'slide-in': 'slideIn 200ms ease-out',
        'slide-out': 'slideOut 200ms ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-10px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
