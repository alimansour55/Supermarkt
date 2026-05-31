import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/apiServices';
import { STORAGE_KEYS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken, removeToken] = useLocalStorage(STORAGE_KEYS.TOKEN, null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Skip the next getMe fetch right after verifyOtp — avoids clearing a fresh session */
  const skipNextFetch = useRef(false);

  const fetchUser = useCallback(async () => {
    if (!token) {
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
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, removeToken]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const sendOtp = async (payload) => {
    setError(null);
    const { data } = await authService.sendOtp(payload);
    return data;
  };

  const verifyOtp = async (payload) => {
    setError(null);
    const { data } = await authService.verifyOtp(payload);
    skipNextFetch.current = true;
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
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
      setUser(null);
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      isAuthenticated: !!user,
      sendOtp,
      verifyOtp,
      resendOtp,
      logout,
      setError,
      refreshUser: fetchUser,
    }),
    [user, token, loading, error, fetchUser],
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
