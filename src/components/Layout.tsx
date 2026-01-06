import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main layout component providing app-wide structure
 * Includes header, main content area, and footer
 * Responsive and accessible by default
 */
export function Layout({ children }: LayoutProps): React.ReactElement {
  return (
    <div className="bg-surface-light dark:bg-surface-dark flex min-h-dvh flex-col">
      {/* Header with branding and theme toggle */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </header>

      {/* Main content area - flexible and grows to fill space */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      {/* Footer with version and links */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Footer />
        </div>
      </footer>
    </div>
  );
}
