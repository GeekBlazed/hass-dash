import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';

type MediaMode = 'music' | 'video';

type Playlist = {
  id: string;
  name: string;
  description: string;
};

type VideoSource = {
  id: string;
  label: string;
  logoIcon: string;
  logoBlockClassName: 'apple-logo-block' | 'amazon-logo-block' | 'android-logo-block';
};

const SAMPLE_PLAYLISTS: Playlist[] = [
  { id: 'mix-01', name: 'Morning Momentum', description: 'Upbeat blend for a quick start.' },
  { id: 'mix-02', name: 'Lo-Fi Focus', description: 'Calm instrumentals for deep work.' },
  { id: 'mix-03', name: 'After Hours', description: 'Smooth tracks for late evening sessions.' },
  {
    id: 'mix-04',
    name: 'Weekend Throwbacks',
    description: 'Classic hits from the 80s through 2000s.',
  },
];

const VIDEO_SOURCES: VideoSource[] = [
  {
    id: 'firestick-4k-1',
    label: 'Firestick 4K 1',
    logoIcon: 'simple-icons:amazonfiretv',
    logoBlockClassName: 'amazon-logo-block',
  },
  {
    id: 'firestick-4k-2',
    label: 'Firestick 4K 2',
    logoIcon: 'simple-icons:amazonfiretv',
    logoBlockClassName: 'amazon-logo-block',
  },
  {
    id: 'firestick-3',
    label: 'Firestick 3',
    logoIcon: 'simple-icons:amazonfiretv',
    logoBlockClassName: 'amazon-logo-block',
  },
  {
    id: 'firestick-4',
    label: 'Firestick 4',
    logoIcon: 'simple-icons:amazonfiretv',
    logoBlockClassName: 'amazon-logo-block',
  },
  {
    id: 'apple-tv',
    label: 'Apple TV',
    logoIcon: 'simple-icons:apple',
    logoBlockClassName: 'apple-logo-block',
  },
  {
    id: 'android-tv',
    label: 'Android TV',
    logoIcon: 'simple-icons:android',
    logoBlockClassName: 'android-logo-block',
  },
];

const FIRESTICK_STAGE_STREAM_URL = 'http://stream1.tv:8889/hdmi/';

export function MediaPanel({ isHidden = true }: { isHidden?: boolean }) {
  const [activeMode, setActiveMode] = useState<MediaMode>('music');
  const [activeVideoSourceId, setActiveVideoSourceId] = useState<string>(VIDEO_SOURCES[0].id);
  const setStageMediaStreamUrl = useDashboardStore((s) => s.setStageMediaStreamUrl);

  useEffect(() => {
    const shouldShowStream = activeMode === 'video' && activeVideoSourceId === 'firestick-4k-1';
    setStageMediaStreamUrl(shouldShowStream ? FIRESTICK_STAGE_STREAM_URL : null);
  }, [activeMode, activeVideoSourceId, setStageMediaStreamUrl]);

  useEffect(() => {
    return () => {
      setStageMediaStreamUrl(null);
    };
  }, [setStageMediaStreamUrl]);

  return (
    <section
      id="media-window"
      className={isHidden ? 'tile media-window is-hidden' : 'tile media-window'}
      aria-label="Media player"
    >
      <div className="media-window__header" aria-label="Media window header">
        <div className="media-window__title" role="group" aria-label="Media type">
          <button
            type="button"
            className={
              activeMode === 'music'
                ? 'media-window__pill media-window__pill--active'
                : 'media-window__pill'
            }
            aria-pressed={activeMode === 'music'}
            onClick={() => setActiveMode('music')}
          >
            <Icon
              icon="mdi:music"
              aria-hidden="true"
              data-testid="media-icon"
              className="media-icon"
            />
            Music
          </button>
          <button
            type="button"
            className={
              activeMode === 'video'
                ? 'media-window__pill media-window__pill--active'
                : 'media-window__pill'
            }
            aria-pressed={activeMode === 'video'}
            onClick={() => setActiveMode('video')}
          >
            <Icon
              icon="mdi:video"
              aria-hidden="true"
              data-testid="media-icon"
              className="media-icon"
            />
            Video
          </button>
        </div>
      </div>

      <div className="media" aria-label="Now playing">
        {activeMode === 'music' ? (
          <div className="media-window__music" aria-label="Music playlists">
            <div className="track" id="media-track">
              Playlists
            </div>
            <ul className="media-window__list" aria-label="Playlist list">
              {SAMPLE_PLAYLISTS.map((playlist) => (
                <li key={playlist.id} className="media-window__list-item">
                  <span className="media-window__list-title">{playlist.name}</span>
                  <span className="media-window__list-subtitle">{playlist.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="media-window__video" aria-label="Video sources">
            <div className="track" id="media-track">
              Sources
            </div>
            <div className="media-window__source-list" role="group" aria-label="Video source list">
              {VIDEO_SOURCES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={
                    activeVideoSourceId === source.id
                      ? 'media-window__source-toggle media-window__source-toggle--active'
                      : 'media-window__source-toggle'
                  }
                  aria-pressed={activeVideoSourceId === source.id}
                  onClick={() => setActiveVideoSourceId(source.id)}
                >
                  <span
                    className={`media-window__source-logo ${source.logoBlockClassName}`}
                    aria-hidden="true"
                  >
                    <Icon icon={source.logoIcon} aria-hidden="true" />
                  </span>
                  <span className="media-window__source-label">{source.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeMode === 'music' && (
        <div className="controls" aria-label="Media controls">
          <div className="buttons" role="group" aria-label="Playback">
            <div className="btn" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="rgba(234,231,223,0.85)" d="M11 18V6l-8.5 6L11 18zm1-12v12h2V6h-2z" />
              </svg>
            </div>
            <div className="btn" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="rgba(234,231,223,0.85)" d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="btn" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="rgba(234,231,223,0.85)" d="M13 6v12l8.5-6L13 6zM4 18h2V6H4v12z" />
              </svg>
            </div>
          </div>
          <div className="scrub" aria-hidden="true">
            <span></span>
          </div>
        </div>
      )}
    </section>
  );
}
