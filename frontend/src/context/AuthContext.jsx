import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/apiServices';
import { STORAGE_KEYS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { usesBearerToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Native app: bearer token. Web: httpOnly cookie + a harmless "session exists" hint.
  // A token left in web storage by an older build is still honoured until the next sign-in.
  const [token, setToken, removeToken] = useLocalStorage(STORAGE_KEYS.TOKEN, null);
  const [sessionHint, setSessionHint, removeSessionHint] = useLocalStorage(STORAGE_KEYS.SESSION_HINT, false);
  const hasSession = Boolean(token || sessionHint);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Skip the next getMe fetch right after verifyOtp — avoids clearing a fresh session */
  const skipNextFetch = useRef(false);

  const fetchUser = useCallback(async () => {
    if (!hasSession) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await authService.getMe();
      setUser(data.user);
    } catch (err) {
      // Only drop the session when the server rejects it — a network blip or
      // a 5xx must not sign the customer out.
      if (err.response?.status === 401) {
        removeToken();
        removeSessionHint();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [hasSession, removeToken, removeSessionHint]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Session kept through an outage — restore the user once the connection is back.
  useEffect(() => {
    if (!hasSession || user) return undefined;
    const retry = () => fetchUser();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [hasSession, user, fetchUser]);

  /** Store whatever the server issued: bearer token (native) or just the cookie-session hint (web). */
  const startSession = (data) => {
    // Flipping hasSession re-runs fetchUser; we already have the user, so skip that one.
    skipNextFetch.current = !hasSession;
    if (usesBearerToken && data.token) {
      setToken(data.token);
    } else {
      removeToken();
      setSessionHint(true);
    }
    setUser(data.user);
    setLoading(false);
  };

  const sendOtp = async (payload) => {
    setError(null);
    const { data } = await authService.sendOtp(payload);
    return data;
  };

  const verifyOtp = async (payload) => {
    setError(null);
    const { data } = await authService.verifyOtp(payload);
    sessionStorage.setItem(STORAGE_KEYS.PENDING_CART_MERGE, '1');
    startSession(data);
    return data;
  };

  const adminLogin = async (username, password) => {
    setError(null);
    const { data } = await authService.adminLogin({ username, password });
    // Staff with a phone must confirm an SMS code first — no session yet.
    if (!data.mfaRequired) startSession(data);
    return data;
  };

  const verifyAdminMfa = async (mfaToken, code) => {
    setError(null);
    const { data } = await authService.adminMfaVerify({ mfaToken, code });
    startSession(data);
    return data;
  };

  const resendAdminMfa = async (mfaToken, lang) => {
    setError(null);
    const { data } = await authService.adminMfaResend({ mfaToken, lang });
    return data;
  };

  const driverLogin = async (username, password) => {
    setError(null);
    const { data } = await authService.driverLogin({ username, password });
    startSession(data);
    return data;
  };

  const resendOtp = async (payload) => {
    setError(null);
    const { data } = await authService.resendOtp(payload);
    return data;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore logout errors
    } finally {
      skipNextFetch.current = false;
      removeToken();
      removeSessionHint();
      setUser(null);
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      hasSession,
      loading,
      error,
      isAuthenticated: !!user,
      sendOtp,
      verifyOtp,
      adminLogin,
      verifyAdminMfa,
      resendAdminMfa,
      driverLogin,
      resendOtp,
      logout,
      setError,
      refreshUser: fetchUser,
    }),
    [user, token, hasSession, loading, error, fetchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
