import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi, ADMIN_SETTINGS_SAVED_EVENT } from '../adminApi';
import { normalizeDriverSettings } from '../utils/storeSettingsDefaults';

/** Optional services; `false` hides their screens from the menu. Unknown = shown. */
const DEFAULT_FEATURES = {};

function featuresFromSettings(data) {
  return {
    loyalty: data?.loyalty?.enabled !== false,
    wallet: data?.wallet?.enabled !== false,
    liveChat: data?.liveChat?.enabled !== false,
    partnerRevenue: data?.partnerRevenue?.enabled === true,
  };
}

const AdminPanelContext = createContext({
  showRevenue: true,
  features: DEFAULT_FEATURES,
  driverSettings: normalizeDriverSettings(),
  loading: true,
  refreshAdminPanel: () => {},
});

export function AdminPanelProvider({ children }) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [driverSettings, setDriverSettings] = useState(() => normalizeDriverSettings());
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  const refreshAdminPanel = useCallback(() => {
    adminApi.getMarketplaceSettings()
      .then(({ data }) => {
        setFeatures((prev) => ({ ...prev, marketplace: data.data?.enabled !== false }));
      })
      .catch(() => {});

    adminApi.getStoreSettings()
      .then(({ data }) => {
        setShowRevenue(data.data?.adminPanel?.showRevenue !== false);
        setDriverSettings(normalizeDriverSettings(data.data?.driverSettings));
        setFeatures((prev) => ({ ...prev, ...featuresFromSettings(data.data) }));
      })
      .catch(() => {
        setShowRevenue(true);
        setDriverSettings(normalizeDriverSettings());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshAdminPanel();
    window.addEventListener(ADMIN_SETTINGS_SAVED_EVENT, refreshAdminPanel);
    return () => window.removeEventListener(ADMIN_SETTINGS_SAVED_EVENT, refreshAdminPanel);
  }, [refreshAdminPanel]);

  return (
    <AdminPanelContext.Provider value={{ showRevenue, features, driverSettings, loading, refreshAdminPanel }}>
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel() {
  return useContext(AdminPanelContext);
}
