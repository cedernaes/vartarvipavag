import React, { useEffect, useState } from 'react';
import InterrailMap from './components/InterrailMap';
import LoginForm from './components/LoginForm';
import TelegramFeed from './components/TelegramFeed';
import TravelStats from './components/TravelStats';
import { FeedService, PositionService, deterministicRandomizePosition } from './services/api';
import { Position, Post } from './types';
import ForkMeOnGithub from './components/ForkMeOnGithub';

const App: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Check authentication status on app load
  useEffect(() => {
    // Check if user has stored API key
    const isAuth = PositionService.isAuthenticated();
    setIsAuthenticated(isAuth);
    setAuthChecked(true);
  }, []);

  // Fetch positions from API
  const fetchPositions = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const data: Position[] = await PositionService.getAllPositions();

      try {
        const feedData = await FeedService.getFeed();
        setPosts(feedData);
      } catch {
        // Feed unavailable in local dev without server
      }

      setPositions(deterministicRandomizePosition(data));

    } catch (err) {
      console.error('Error fetching positions:', err);

      // If unauthorized, redirect to login
      if (err instanceof Error && err.message.includes('401')) {
        setIsAuthenticated(false);
        setError('Authentication expired. Please log in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load after authentication
  useEffect(() => {
    if (isAuthenticated && authChecked) {
      fetchPositions();
    }
  }, [isAuthenticated, authChecked]);

  // Refresh positions every 10 minutes when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchPositions, 10 * 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setError(null);
  };

  const handleLogout = () => {
    PositionService.logout();
    setIsAuthenticated(false);
  };

  const handleRefresh = (): void => {
    fetchPositions();
  };

  if (!authChecked) {
    return (
      <div className="app">
        <div className="loading">
          <h3>🔄 Loading...</h3>
          <p>Checking authentication</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1>Tågluff 2026 🚂</h1>
          <h2>Sara & Erasmus</h2>
        </div>
      </header>

      <main className="container">
        {error && (
          <div className="error">
            <strong>Fel:</strong> {error}
            <button 
              onClick={handleRefresh}
              style={{
                marginLeft: '10px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Försök igen
            </button>
          </div>
        )}
        {import.meta.env.DEV && (
          <button onClick={handleLogout}>Logga ut</button>
        )}

        {loading && positions.length === 0 ? (
          <div className="loading">
            <div>
              <h3>🔄 Laddar din resa...</h3>
              <p>Hämtar positionsdata från servern</p>
            </div>
          </div>
        ) : (
          <>
            <InterrailMap
              positions={positions}
              posts={posts}
            />
            <TravelStats positions={positions} />
            <TelegramFeed posts={posts} />
          </>
        )}
      </main>

      <footer>
        <div className="footer-content">
          <p>En app av Sara & Erasmus</p>
          <p>Drivs av Home Assistant & TypeScript | Kartor av OpenStreetMap</p>
        </div>
        {import.meta.env.VITE_REPO_URL && 
          <ForkMeOnGithub href={import.meta.env.VITE_REPO_URL} />
        }
      </footer>
    </div>
  );
};

export default App; 
