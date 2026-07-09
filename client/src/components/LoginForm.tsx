import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
  showAdminOption?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ showAdminOption = false }) => {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(showAdminOption); // Auto-enable if accessed via admin URL

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(password, isAdminMode, isAdminMode ? totpCode : undefined);
      setPassword('');
      setTotpCode('');
    } catch (error: any) {
      console.error('Login failed:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Login failed. Please check your password.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🗺️ Vart är vi på väg?</h2>
        <p>Ange lösenord för att få tillgång till sidan.</p>

        <form onSubmit={handleSubmit} className="login-form">
          {showAdminOption && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={isAdminMode}
                  onChange={(e) => setIsAdminMode(e.target.checked)}
                  disabled={isLoading}
                  className="admin-checkbox"
                />
                <span>Admin-läge</span>
              </label>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="password">Lösenord:</label>
            <div className="password-input-container">
              {/* Force the browser to recognize the passwords as different users */}
              <input type="text" name="username" value={isAdminMode ? 'admin' : 'user'} autoComplete="username" readOnly tabIndex={-1} style={{ display: 'none' }} />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ange lösenord"
                disabled={isLoading}
                required
                autoComplete="current-password"
                className="password-input"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="password-toggle-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                disabled={isLoading}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {showPassword ? (
                    // Eye icon (visible)
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  ) : (
                    // Eye slash icon (hidden)
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
          
          {isAdminMode && (
            <div className="form-group">
              <label htmlFor="totp">2FA-kod:</label>
              <input
                type="text"
                id="totp"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456 (om konfigurerad)"
                disabled={isLoading}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="password-input"
              />
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="login-button"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
