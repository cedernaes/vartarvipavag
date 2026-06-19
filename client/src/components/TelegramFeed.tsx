import React, { useState } from 'react';
import { Post } from '../types';
import { FeedService } from '../services/api';

interface Props {
  posts: Post[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
}

const TelegramFeed: React.FC<Props> = ({ posts }) => {
  const [selected, setSelected] = useState<Post | null>(null);

  if (posts.length === 0) {
    return (
      <section id="feed" className="feed-section">
        <h2>Reseflöde</h2>
        <p className="feed-empty">Inga inlägg än — skicka ett foto eller meddelande via Telegram!</p>
      </section>
    );
  }

  return (
    <section id="feed" className="feed-section">
      <h2>Resan i bilder</h2>

      <div className="feed-grid">
        {posts.map((post) => (
          <button
            key={post.id}
            className={`feed-cell feed-cell--${post.type}`}
            onClick={() => setSelected(post)}
            aria-label={post.caption || post.type}
          >
            <div className="feed-cell__photo-area">
              {post.type === 'photo' && post.media_path && (
                <img
                  src={FeedService.getMediaUrl(post.media_path)}
                  alt={post.caption || ''}
                  loading="lazy"
                />
              )}
              {post.type === 'video' && post.media_path && (
                <div className="feed-cell__video-thumb">
                  <video
                    src={`${FeedService.getMediaUrl(post.media_path)}#t=0.001`}
                    preload="metadata"
                    muted
                    playsInline
                    className="feed-cell__video-preview"
                  />
                  <span className="feed-cell__play">▶</span>
                </div>
              )}
              {post.type === 'text' && (
                <div className="feed-cell__text-preview">
                  <p>{post.caption}</p>
                  {post.latitude != null && (
                    <span className="feed-cell__pin">📍</span>
                  )}
                </div>
              )}
            </div>
            <div className="feed-cell__info">
              {post.caption && post.type !== 'text' && (
                <p className="feed-cell__caption">{post.caption}</p>
              )}
              <time className="feed-cell__time">
                {formatDate(post.timestamp)}{post.telegram_user && ` av ${post.telegram_user}`}
              </time>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="feed-modal-backdrop" onClick={() => setSelected(null)}>
          <button className="feed-modal__close" onClick={() => setSelected(null)}>✕</button>
          <div className="feed-modal" onClick={(e) => e.stopPropagation()}>
            {selected.type === 'photo' && selected.media_path && (
              <img
                src={FeedService.getMediaUrl(selected.media_path)}
                alt={selected.caption || ''}
                className="feed-modal__media"
              />
            )}

            {selected.type === 'video' && selected.media_path && (
              <video
                src={FeedService.getMediaUrl(selected.media_path)}
                controls
                className="feed-modal__media"
              />
            )}

            {selected.type === 'text' && (
              <div className="feed-modal__text-area">
                <p>{selected.caption}</p>
                {selected.latitude != null && <span className="feed-cell__pin">📍</span>}
              </div>
            )}

            <div className="feed-modal__meta">
              {selected.caption && selected.type !== 'text' && (
                <p className="feed-modal__caption">{selected.caption}</p>
              )}
              <time className="feed-modal__time">
                {formatDate(selected.timestamp)}{selected.telegram_user && ` av ${selected.telegram_user}`}
              </time>
              {selected.latitude != null && selected.longitude != null && (
                <p className="feed-modal__coords">
                  📍 {formatCoords(selected.latitude, selected.longitude)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TelegramFeed;
