export function MediaPanel({ isHidden = true }: { isHidden?: boolean }) {
  return (
    <section
      id="media-window"
      className={isHidden ? 'tile media-window is-hidden' : 'tile media-window'}
      aria-label="Media player"
    >
      <div className="media-window__header" aria-label="Media window header">
        <div className="media-window__title">
          <span className="media-window__pill">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="rgba(234,231,223,0.85)"
                d="M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm-1 5v8l7-4-7-4z"
              />
            </svg>
            Spotify
          </span>
        </div>
      </div>

      <div className="media" aria-label="Now playing">
        <div className="track" id="media-track">
          All Along the Wa...
        </div>
        <div className="artist" id="media-artist">
          Jimi Hendrix
        </div>
      </div>

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
    </section>
  );
}
