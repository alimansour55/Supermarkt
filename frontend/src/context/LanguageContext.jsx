/**
 * RTL / LTR language context — Arabic default.
 *
 * On storefront pages the language comes from the URL (/ar/..., /en/...) so the
 * server and browser always agree, and switching language navigates to the same
 * page in the other language. Outside the storefront (admin, driver app) the
 * visitor's saved preference is used.
 */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
// Raw router hooks on purpose: this provider works with the real, prefixed URL.
// eslint-disable-next-line no-restricted-imports
import { useLocation as useRouterLocation, useNavigate as useRouterNavigate } from 'react-router';
import { LANGUAGES, STORAGE_KEYS } from '../utils/constants';
import ar from '../i18n/ar';
import en from '../i18n/en';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { langFromPath, swapLang } from '../i18n/routing';

const translations = { ar, en };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const location = useRouterLocation();
  const navigate = useRouterNavigate();
  const [storedLanguage, setStoredLanguage] = useLocalStorage(STORAGE_KEYS.LANGUAGE, LANGUAGES.AR);
  const urlLanguage = langFromPath(location.pathname);
  const language = urlLanguage || (translations[storedLanguage] ? storedLanguage : LANGUAGES.AR);

  // Remember the language of the last storefront page (used by admin/driver screens).
  useEffect(() => {
    if (urlLanguage && urlLanguage !== storedLanguage) setStoredLanguage(urlLanguage);
  }, [urlLanguage, storedLanguage, setStoredLanguage]);

  const switchLanguage = useCallback((lang) => {
    if (!translations[lang]) return;
    if (urlLanguage) {
      if (lang === urlLanguage) return;
      navigate(`${swapLang(location.pathname, lang)}${location.search}${location.hash}`);
    } else {
      setStoredLanguage(lang);
    }
  }, [urlLanguage, navigate, location.pathname, location.search, location.hash, setStoredLanguage]);

  const value = useMemo(() => ({
    language,
    isRTL: language === LANGUAGES.AR,
    t: translations[language] || translations.ar,
    toggleLanguage: () => switchLanguage(language === LANGUAGES.AR ? LANGUAGES.EN : LANGUAGES.AR),
    switchLanguage,
  }), [language, switchLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
