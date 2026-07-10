import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import LoginForm from './components/LoginForm';
import { FeedService, PositionService, deterministicRandomizePosition } from './services/api';
import { Position, Post } from './types';
import ForkMeOnGithub from './components/ForkMeOnGithub';
import { useAuth } from './contexts/AuthContext';

interface TravelData {
  positions: Position[];
  posts: Post[];
  loading: boolean;
  fetchPositions: () => void;
}

const TravelDataContext = createContext<TravelData>({
  positions: [],
  posts: [],
  loading: true,
  fetchPositions: () => {},
});

export const useTravelData = () => useContext(TravelDataContext);

const tabLinkStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '6px',
  border: '1px solid #fbbf24',
  background: 'transparent',
  fontWeight: 400,
  cursor: 'pointer',
  fontSize: '13px',
  textDecoration: 'none',
  color: 'inherit',
};

const App: React.FC = () => {
  const { isAuthenticated, isAdminMode, logout } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAuthenticated) fetchPositions();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchPositions, 10 * 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminUrl = urlParams.get('admin') === 'true' || window.location.hash === '#admin';
    return (
      <div className="app">
        <LoginForm showAdminOption={isAdminUrl} />
      </div>
    );
  }

  return (
    <TravelDataContext.Provider value={{ positions, posts, loading, fetchPositions }}>
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
                onClick={fetchPositions}
                style={{
                  marginLeft: '10px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
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
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '20px' }}>🔧</span>
                  <strong>Inloggad som administratör</strong>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <Link
                      to="/"
                      style={tabLinkStyle}
                      activeProps={{ style: { ...tabLinkStyle, background: '#fbbf24', fontWeight: 600 } }}
                      activeOptions={{ exact: true }}
                    >
                      Resa
                    </Link>
                    <Link
                      to="/sessioner"
                      style={tabLinkStyle}
                      activeProps={{ style: { ...tabLinkStyle, background: '#fbbf24', fontWeight: 600 } }}
                    >
                      Sessioner
                    </Link>
                  </div>
                </div>
              )}
              <Outlet />
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
    </TravelDataContext.Provider>
  );
};

export default App;
