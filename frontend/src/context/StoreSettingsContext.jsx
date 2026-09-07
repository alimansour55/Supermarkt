import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from './LanguageContext';
import { fetchStoreSettings } from '../services/storeSettingsApi';
import { applySiteTheme, isThemePreviewActive, shouldApplyCommittedTheme } from '../utils/applySiteTheme';
import { applySiteFont, shouldApplyCommittedFont } from '../utils/applySiteFont';
import { DEFAULT_THEME_COLOR, DEFAULT_THEME_SHADE } from '../constants/siteThemes';
import { DEFAULT_SITE_FONT } from '../constants/siteFonts';
import { normalizeThemeRotation } from '../constants/themeRotation';
import { setThemeRotationStoppedHandler, startThemeRotation, stopThemeRotation } from '../utils/themeRotation';
import { readSessionCache, writeSessionCache } from '../utils/sessionCache';

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

export function StoreSettingsProvider({ children }) {
  const { language } = useLanguage();
  const [settings, setSettings] = useState(() => readSessionCache(SETTINGS_CACHE_KEY));
  const [loading, setLoading] = useState(() => !readSessionCache(SETTINGS_CACHE_KEY));
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

  useEffect(() => {
    if (!settings?.seo) return;
    const isAr = language === 'ar';
    const title = isAr ? settings.seo.defaultTitleAr : settings.seo.defaultTitleEn;
    const description = isAr ? settings.seo.defaultDescriptionAr : settings.seo.defaultDescriptionEn;
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
    if (settings.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]');
      if (link) link.setAttribute('href', settings.faviconUrl);
    }
  }, [language, settings]);

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
