import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, AuthService, PositionService } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdminMode: boolean;
  login: (password: string, isAdmin: boolean, totpCode?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isAdminMode: false,
  login: async () => { },
  logout: () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('apiKey'));
  const [adminApiKey, setAdminApiKey] = useState<string | null>(localStorage.getItem('adminApiKey'));

  const isAuthenticated = apiKey !== null || adminApiKey !== null;
  const isAdminMode = adminApiKey !== null;

  // Updated synchronously on every render, so the interceptor always reads the
  // latest keys without needing to re-register its closure on each key change.
  const keysRef = useRef({ apiKey, adminApiKey });
  keysRef.current = { apiKey, adminApiKey };

  useEffect(() => {
    if (apiKey) localStorage.setItem('apiKey', apiKey);
    else localStorage.removeItem('apiKey');
  }, [apiKey]);

  useEffect(() => {
    if (adminApiKey) localStorage.setItem('adminApiKey', adminApiKey);
    else localStorage.removeItem('adminApiKey');
  }, [adminApiKey]);

  // Registered once — reads from keysRef so the closure is never stale.
  // useLayoutEffect ensures this runs before any child useEffect (e.g. the
  // first fetchPositions call in App), so requests always have the auth header.
  useLayoutEffect(() => {
    const id = api.interceptors.request.use((config) => {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      const { apiKey, adminApiKey } = keysRef.current;
      if (adminApiKey) config.headers['x-api-key'] = adminApiKey;
      else if (apiKey) config.headers['x-api-key'] = apiKey;
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, []);

  // Response interceptor registered once — clears keys on 401
  useLayoutEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Response Error:', error);
        if (error.response?.status === 403) {
          console.error('Write operations are restricted to localhost');
        }
        if (error.response?.status === 401) {
          setApiKey(null);
          setAdminApiKey(null);
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = async (password: string, isAdmin: boolean, totpCode?: string): Promise<void> => {
    if (isAdmin) {
      const key = await PositionService.adminLogin(password, totpCode ?? '');
      setAdminApiKey(key);
    } else {
      const key = await PositionService.login(password);
      setApiKey(key);
    }
  };

  const logout = () => {
    AuthService.logout(); // best-effort server-side invalidation
    setApiKey(null);
    setAdminApiKey(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdminMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
