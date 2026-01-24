import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PwaInstallButton } from './PwaInstallButton';

type MatchMediaStub = (matches: boolean) => void;

const setMatchMedia: MatchMediaStub = (matches) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const setNavigatorStandalone = (value: boolean | undefined) => {
  if (value === undefined) {
    // Make `'standalone' in navigator` false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).standalone;
    return;
  }

  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value,
  });
};

describe('PwaInstallButton', () => {
  beforeEach(() => {
    setMatchMedia(false);
    setNavigatorStandalone(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when no install prompt is available', () => {
    render(<PwaInstallButton />);
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('renders nothing when already installed (standalone display-mode)', () => {
    setMatchMedia(true);
    render(<PwaInstallButton />);
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('renders nothing when already installed (iOS standalone)', () => {
    setMatchMedia(false);
    setNavigatorStandalone(true);
    render(<PwaInstallButton />);
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();
  });

  it('shows the install button after beforeinstallprompt, then hides after install click', async () => {
    setMatchMedia(false);

    const prompt = vi.fn(async () => undefined);
    const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });

    render(<PwaInstallButton />);

    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();

    const event = new Event('beforeinstallprompt');
    // @ts-expect-error test-only shape.
    event.prompt = prompt;
    // @ts-expect-error test-only shape.
    event.userChoice = userChoice;

    fireEvent(window, event);

    expect(await screen.findByRole('button', { name: /install app/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /install app/i }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: /install app/i })).toBeNull());
  });

  it('hides the install button after appinstalled event', async () => {
    setMatchMedia(false);

    const prompt = vi.fn(async () => undefined);
    const userChoice = Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' });

    render(<PwaInstallButton />);

    const event = new Event('beforeinstallprompt');
    // @ts-expect-error test-only shape.
    event.prompt = prompt;
    // @ts-expect-error test-only shape.
    event.userChoice = userChoice;

    fireEvent(window, event);

    expect(await screen.findByRole('button', { name: /install app/i })).toBeInTheDocument();

    fireEvent(window, new Event('appinstalled'));

    await waitFor(() => expect(screen.queryByRole('button', { name: /install app/i })).toBeNull());
  });
});
