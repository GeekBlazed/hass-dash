/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#5c6bc0',
          DEFAULT: '#3f51b5',
          dark: '#303f9f',
        },
        surface: {
          light: '#ffffff',
          DEFAULT: '#f5f5f5',
          dark: '#121212',
        },
      },
    },
  },
  plugins: [],
};
