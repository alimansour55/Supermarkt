import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/apiServices';
import { STORAGE_KEYS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken, removeToken, tokenReady] = useLocalStorage(STORAGE_KEYS.TOKEN, null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Skip the next getMe fetch right after verifyOtp — avoids clearing a fresh session */
  const skipNextFetch = useRef(false);
  /** Mirrors `user` so fetchUser can tell a background refresh from a first load. */
  const userRef = useRef(null);
  userRef.current = user;

  const fetchUser = useCallback(async () => {
    // After SSR the stored token is read post-hydration — stay "loading" until then
    // so protected routes don't redirect a signed-in user to /login.
    if (!tokenReady) return;
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

    // Only a first load shows the global loading state. A refresh of a signed-in user
    // (refreshUser) stays silent: flipping `loading` makes ProtectedRoute unmount the
    // page, and a page that refreshes on mount would then remount itself forever.
    const silent = Boolean(userRef.current);
    if (!silent) setLoading(true);
    try {
      const { data } = await authService.getMe();
      setUser(data.user);
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, tokenReady, removeToken]);

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
    sessionStorage.setItem(STORAGE_KEYS.PENDING_CART_MERGE, '1');
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data;
  };

  const adminLogin = async (username, password) => {
    setError(null);
    const payload = password !== undefined
      ? { username, password }
      : { password: username };
    const { data } = await authService.adminLogin(payload);
    skipNextFetch.current = true;
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data;
  };

  const driverLogin = async (username, password) => {
    setError(null);
    const { data } = await authService.driverLogin({ username, password });
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
      adminLogin,
      driverLogin,
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
