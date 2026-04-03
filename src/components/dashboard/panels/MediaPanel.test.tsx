import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { MediaPanel } from './MediaPanel';

describe('MediaPanel', () => {
  it('sets stage stream url only for Firestick 4K 1 selection', () => {
    render(<MediaPanel isHidden={false} />);

    expect(useDashboardStore.getState().stageMediaStreamUrl).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Video' }));
    expect(useDashboardStore.getState().stageMediaStreamUrl).toBe('http://stream1.tv:8889/hdmi/');

    fireEvent.click(screen.getByRole('button', { name: 'Apple TV' }));
    expect(useDashboardStore.getState().stageMediaStreamUrl).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    expect(useDashboardStore.getState().stageMediaStreamUrl).toBeNull();
  });

  it('is hidden by default', () => {
    render(<MediaPanel />);
    const root = screen.getByLabelText('Media player');
    expect(root).toHaveClass('tile');
    expect(root).toHaveClass('media-window');
    expect(root).toHaveClass('is-hidden');
  });

  it('is visible when isHidden=false', () => {
    render(<MediaPanel isHidden={false} />);
    const root = screen.getByLabelText('Media player');
    expect(root).toHaveClass('tile');
    expect(root).toHaveClass('media-window');
    expect(root).not.toHaveClass('is-hidden');
  });

  it('allows only one media mode toggle to be active at a time', () => {
    render(<MediaPanel isHidden={false} />);

    const musicButton = screen.getByRole('button', { name: 'Music' });
    const videoButton = screen.getByRole('button', { name: 'Video' });

    expect(musicButton).toHaveAttribute('aria-pressed', 'true');
    expect(videoButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(videoButton);

    expect(musicButton).toHaveAttribute('aria-pressed', 'false');
    expect(videoButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows playlists in music mode and video sources in video mode', () => {
    render(<MediaPanel isHidden={false} />);

    expect(screen.getByLabelText('Music playlists')).toBeInTheDocument();
    expect(screen.getByText('Morning Momentum')).toBeInTheDocument();
    expect(screen.queryByLabelText('Video sources')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Video' }));

    expect(screen.getByLabelText('Video sources')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Firestick 4K 1' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Music playlists')).not.toBeInTheDocument();
  });

  it('allows only one video source toggle to be active at a time', () => {
    render(<MediaPanel isHidden={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Video' }));

    const defaultSource = screen.getByRole('button', { name: 'Firestick 4K 1' });
    const appleTvSource = screen.getByRole('button', { name: 'Apple TV' });

    expect(defaultSource).toHaveAttribute('aria-pressed', 'true');
    expect(appleTvSource).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(appleTvSource);

    expect(defaultSource).toHaveAttribute('aria-pressed', 'false');
    expect(appleTvSource).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows media controls only in music mode', () => {
    render(<MediaPanel isHidden={false} />);

    expect(screen.getByLabelText('Media controls')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Video' }));

    expect(screen.queryByLabelText('Media controls')).not.toBeInTheDocument();
  });
});
