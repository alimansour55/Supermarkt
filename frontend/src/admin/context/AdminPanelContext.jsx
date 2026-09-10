import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { normalizeDriverSettings } from '../utils/storeSettingsDefaults';

const AdminPanelContext = createContext({
  showRevenue: true,
  driverSettings: normalizeDriverSettings(),
  loading: true,
  refreshAdminPanel: () => {},
});

export function AdminPanelProvider({ children }) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [driverSettings, setDriverSettings] = useState(() => normalizeDriverSettings());
  const [loading, setLoading] = useState(true);

  const refreshAdminPanel = useCallback(() => {
    adminApi.getStoreSettings()
      .then(({ data }) => {
        setShowRevenue(data.data?.adminPanel?.showRevenue !== false);
        setDriverSettings(normalizeDriverSettings(data.data?.driverSettings));
      })
      .catch(() => {
        setShowRevenue(true);
        setDriverSettings(normalizeDriverSettings());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshAdminPanel();
  }, [refreshAdminPanel]);

  return (
    <AdminPanelContext.Provider value={{ showRevenue, driverSettings, loading, refreshAdminPanel }}>
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel() {
  return useContext(AdminPanelContext);
}
