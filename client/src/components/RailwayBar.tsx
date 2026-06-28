import React from 'react';

interface RailwayBarProps {
  /** Whether we're currently travelling. Drives the scrolling animation. */
  isMoving: boolean;
}

/**
 * A flat railway strip that sits on top of the map. When `isMoving` is true the
 * sleepers (and the little train) scroll right-to-left to signify that we're
 * currently on the move; otherwise the track stands still.
 */
const RailwayBar: React.FC<RailwayBarProps> = ({ isMoving }) => {
  return (
    <div
      className={`railway-bar ${isMoving ? 'railway-bar--moving' : ''}`}
      role="img"
      aria-label={isMoving ? 'På väg' : 'Står stilla'}
    >
      <div className="railway-bar__track">
        <span className="railway-bar__rail railway-bar__rail--top" />
        <span className="railway-bar__rail railway-bar__rail--bottom" />
        <span className="railway-bar__ties" />
      </div>
      <span className="railway-bar__train" aria-hidden="true">🚂</span>
      <span className="railway-bar__status">
        {isMoving ? 'På väg' : 'Står stilla'}
      </span>
    </div>
  );
};

export default RailwayBar;
