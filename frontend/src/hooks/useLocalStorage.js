import { useState, useCallback, useRef } from 'react';

function readStoredValue(key, initialValue) {
  try {
    const fromLocal = window.localStorage.getItem(key);
    if (fromLocal != null) return JSON.parse(fromLocal);
  } catch {
    // ignore
  }
  try {
    const fromSession = window.sessionStorage.getItem(key);
    if (fromSession != null) return JSON.parse(fromSession);
  } catch {
    // ignore
  }
  return initialValue;
}

function writeStoredValue(key, value) {
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, serialized);
    return 'local';
  } catch {
    // Safari private mode / storage full
  }
  try {
    window.sessionStorage.setItem(key, serialized);
    return 'session';
  } catch {
    return null;
  }
}

function removeStoredValue(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useLocalStorage(key, initialValue) {
  const memoryFallback = useRef(null);

  const [storedValue, setStoredValue] = useState(() => {
    const value = readStoredValue(key, initialValue);
    if (value !== initialValue) memoryFallback.current = value;
    return value;
  });

  const setValue = useCallback(
    (value) => {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      memoryFallback.current = valueToStore;
      const written = writeStoredValue(key, valueToStore);
      if (!written) {
        console.warn(`Could not persist "${key}" — session may not survive refresh on this browser.`);
      }
    },
    [key, storedValue],
  );

  const removeValue = useCallback(() => {
    removeStoredValue(key);
    memoryFallback.current = null;
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue ?? memoryFallback.current, setValue, removeValue];
}
