import '@testing-library/jest-dom/vitest';
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
beforeEach(() => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

// Cleanup after each test
afterEach(async () => {
  // Many components (e.g. dashboard data loading) schedule microtask-based
  // state updates after initial render. Flush them inside act() to avoid
  // noisy "not wrapped in act(...)" warnings.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  cleanup();
  vi.clearAllMocks();
});
