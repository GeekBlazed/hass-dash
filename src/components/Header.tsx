import { useEffect, useState } from 'react';

interface HeaderProps {
  onMenuClick?: () => void;
}

/**
 * Application header with branding and theme toggle
 * Responsive design that adapts to mobile, tablet, and desktop
 */
export function Header({ onMenuClick }: HeaderProps): React.ReactElement {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply theme to document
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <div className="flex h-16 items-center justify-between">
      {/* Left: Menu button (mobile) + Logo/Title */}
      <div className="flex items-center gap-4">
        {/* Menu button - placeholder for future navigation */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="text-primary hover:text-primary-dark focus:ring-primary -m-2 rounded-lg p-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none lg:hidden"
            aria-label="Open menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        )}

        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label="Home">
            🏠
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">HassDash</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Smart Home Dashboard</p>
          </div>
        </div>
      </div>

      {/* Right: Theme toggle */}
      <button
        onClick={toggleTheme}
        className="text-primary hover:bg-primary/10 focus:ring-primary rounded-lg p-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          // Sun icon for light mode
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
            />
          </svg>
        ) : (
          // Moon icon for dark mode
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
