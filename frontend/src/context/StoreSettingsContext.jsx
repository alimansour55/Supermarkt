import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchStoreSettings } from '../services/storeSettingsApi';
import { applySiteTheme, isThemePreviewActive, shouldApplyCommittedTheme } from '../utils/applySiteTheme';
import { applySiteFont, shouldApplyCommittedFont } from '../utils/applySiteFont';
import { DEFAULT_THEME_COLOR, DEFAULT_THEME_SHADE } from '../constants/siteThemes';
import { DEFAULT_SITE_FONT } from '../constants/siteFonts';
import { normalizeThemeRotation } from '../constants/themeRotation';
import { setThemeRotationStoppedHandler, startThemeRotation, stopThemeRotation } from '../utils/themeRotation';
import { readSessionCache, writeSessionCache } from '../utils/sessionCache';
import { isHydrating } from '../utils/hydration';

const SETTINGS_CACHE_KEY = 'mp_store_settings_v2';

const StoreSettingsContext = createContext({
  settings: null,
  loading: true,
  refreshSettings: () => {},
});

function applyCommittedAppearance(settings) {
  if (isThemePreviewActive()) return;

  const theme = settings?.themeColor || DEFAULT_THEME_COLOR;
  const shade = settings?.themeShade ?? DEFAULT_THEME_SHADE;
  if (!shouldApplyCommittedTheme(theme, shade)) return;

  const rotation = normalizeThemeRotation(settings?.themeRotation, { color: theme, shade });
  if (startThemeRotation(rotation, 'store')) return;

  stopThemeRotation('store', { notify: false });
  applySiteTheme(theme, { themeShade: shade });
}

/**
 * @param {object} props
 * @param {object} [props.initialSettings] settings loaded during SSR (root loader)
 */
export function StoreSettingsProvider({ children, initialSettings = null }) {
  // SSR data wins; the session cache is only read outside hydration so the first
  // browser render matches the server HTML.
  const [initial] = useState(() => initialSettings
    || (isHydrating() ? null : readSessionCache(SETTINGS_CACHE_KEY)));
  const [settings, setSettings] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await fetchStoreSettings();
      setSettings(data);
      writeSessionCache(SETTINGS_CACHE_KEY, data);
    } catch {
      setSettings(null);
    }
  }, []);

  useEffect(() => {
    if (initialSettings) {
      // Fresh from the server — just prime the session cache.
      writeSessionCache(SETTINGS_CACHE_KEY, initialSettings);
      return undefined;
    }
    let mounted = true;
    if (!settings) setLoading(true);
    fetchStoreSettings()
      .then((data) => {
        if (mounted) {
          setSettings(data);
          writeSessionCache(SETTINGS_CACHE_KEY, data);
        }
      })
      .catch(() => {
        if (mounted) setSettings(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSettings();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(refreshSettings, 120000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [refreshSettings]);

  useEffect(() => {
    setThemeRotationStoppedHandler(() => {
      applyCommittedAppearance(settingsRef.current);
    });
    return () => {
      setThemeRotationStoppedHandler(null);
      stopThemeRotation('store');
    };
  }, []);

  useEffect(() => {
    applyCommittedAppearance(settings);
  }, [settings?.themeColor, settings?.themeShade, settings?.themeRotation]);

  useEffect(() => {
    const font = settings?.siteFont || DEFAULT_SITE_FONT;
    if (!shouldApplyCommittedFont(font)) return;
    applySiteFont(font);
  }, [settings?.siteFont]);

  const value = useMemo(
    () => ({ settings, loading, refreshSettings }),
    [settings, loading, refreshSettings],
  );

  return (
    <StoreSettingsContext.Provider value={value}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}

export default StoreSettingsContext;
