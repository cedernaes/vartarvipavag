import React, { useEffect, useState } from 'react';
import { AuthService, Session } from '../services/api';

function parseBrowser(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return ua.substring(0, 40);
}

function parseOS(ua: string | null): string {
  if (!ua) return '';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}

function formatClient(ua: string | null): string {
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  return os ? `${browser} on ${os}` : browser;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const SessionsPanel: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentToken = localStorage.getItem('adminApiKey');

  const load = async () => {
    try {
      setError(null);
      const data = await AuthService.getSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (token: string) => {
    try {
      await AuthService.revokeSession(token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Aktiva sessioner</h3>

      {loading && <p style={{ color: '#6b7280', fontSize: '14px' }}>Laddar...</p>}
      {error && <p style={{ color: '#dc2626', fontSize: '14px' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={thStyle}>Typ</th>
                <th style={thStyle}>Webbläsare</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>Skapad</th>
                <th style={thStyle}>Senast använd</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const isCurrent = s.token === currentToken;
                return (
                  <tr key={s.token} style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: isCurrent ? '#fefce8' : undefined,
                  }}>
                    <td style={tdStyle}>
                      {s.type === 'admin' ? 'Admin' : 'Användare'}
                    </td>
                    <td style={tdStyle}>{formatClient(s.user_agent)}</td>
                    <td style={tdStyle}>{s.ip ?? '—'}</td>
                    <td style={tdStyle}>{formatDate(s.created_at)}</td>
                    <td style={tdStyle}>{formatDate(s.last_accessed_at)}</td>
                    <td style={tdStyle}>
                      {isCurrent ? (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>Nuvarande</span>
                      ) : (
                        <button
                          onClick={() => revoke(s.token)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Återkalla
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: '#6b7280', textAlign: 'center' }}>
                    Inga aktiva sessioner
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: '#4b5563',
  whiteSpace: 'nowrap',
};

export default SessionsPanel;
