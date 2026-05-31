/**
 * RTL / LTR language context — Arabic default, toggles document dir and lang.
 */
import { createContext, useContext, useMemo } from 'react';
import { LANGUAGES } from '../utils/constants';
import ar from '../i18n/ar';
import en from '../i18n/en';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/constants';

const translations = { ar, en };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useLocalStorage(STORAGE_KEYS.LANGUAGE, LANGUAGES.AR);

  const value = useMemo(() => {
    const isRTL = language === LANGUAGES.AR;
    const t = translations[language] || translations.ar;

    const toggleLanguage = () => {
      setLanguage((prev) => (prev === LANGUAGES.AR ? LANGUAGES.EN : LANGUAGES.AR));
    };

    const switchLanguage = (lang) => {
      if (translations[lang]) setLanguage(lang);
    };

    return {
      language,
      isRTL,
      t,
      toggleLanguage,
      switchLanguage,
    };
  }, [language, setLanguage]);

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
