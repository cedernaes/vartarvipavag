import React, { useEffect, useState } from 'react';
import InterrailMap from './components/InterrailMap';
import LoginForm from './components/LoginForm';
import TelegramFeed from './components/TelegramFeed';
import TravelStats from './components/TravelStats';
import { FeedService, PositionService, deterministicRandomizePosition } from './services/api';
import { Position, Post } from './types';
import ForkMeOnGithub from './components/ForkMeOnGithub';
import { useAuth } from './contexts/AuthContext';

const App: React.FC = () => {
  const { isAuthenticated, isAdminMode, logout } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        logout();
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
    if (isAuthenticated) {
      fetchPositions();
    }
  }, [isAuthenticated]);

  // Refresh positions every 10 minutes when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchPositions, 10 * 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleRefresh = (): void => {
    fetchPositions();
  };

  if (!isAuthenticated) {
    // Check for admin mode in URL parameter or hash
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminUrl = urlParams.get('admin') === 'true' || window.location.hash === '#admin';
    
    return (
      <div className="app">
        <LoginForm showAdminOption={isAdminUrl} />
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
          <button onClick={logout}>Logga ut</button>
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
            {isAdminMode && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>🔧</span>
                <strong>Inloggad som administratör</strong>
              </div>
            )}
            <InterrailMap
              positions={positions}
              posts={posts}
              onPositionDeleted={fetchPositions}
            />
            <TravelStats positions={positions} />
            <TelegramFeed posts={posts} onPostDeleted={fetchPositions} />
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
