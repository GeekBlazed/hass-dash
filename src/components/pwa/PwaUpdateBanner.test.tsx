import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updatePromptStore } from '../../pwa/updatePromptStore';
import { PwaUpdateBanner } from './PwaUpdateBanner';

describe('PwaUpdateBanner', () => {
  beforeEach(() => {
    updatePromptStore.hide();
  });

  afterEach(() => {
    updatePromptStore.hide();
    vi.restoreAllMocks();
  });

  it('renders nothing when no update is available', () => {
    render(<PwaUpdateBanner />);
    expect(screen.queryByLabelText(/app update available/i)).toBeNull();
  });

  it('shows banner and hides on Later', async () => {
    render(<PwaUpdateBanner />);

    updatePromptStore.show(async () => undefined);

    expect(await screen.findByLabelText(/app update available/i)).toBeInTheDocument();
    expect(screen.getByText(/update available/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^later$/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/app update available/i)).toBeNull();
    });
  });

  it('invokes apply update on Reload', async () => {
    const applyUpdate = vi.fn(async () => undefined);

    render(<PwaUpdateBanner />);
    updatePromptStore.show(applyUpdate);

    expect(await screen.findByLabelText(/app update available/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^reload$/i }));

    await waitFor(() => {
      expect(applyUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
