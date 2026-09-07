import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';

const AdminPanelContext = createContext({
  showRevenue: true,
  loading: true,
  refreshAdminPanel: () => {},
});

export function AdminPanelProvider({ children }) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshAdminPanel = useCallback(() => {
    adminApi.getStoreSettings()
      .then(({ data }) => {
        setShowRevenue(data.data?.adminPanel?.showRevenue !== false);
      })
      .catch(() => setShowRevenue(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshAdminPanel();
  }, [refreshAdminPanel]);

  return (
    <AdminPanelContext.Provider value={{ showRevenue, loading, refreshAdminPanel }}>
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel() {
  return useContext(AdminPanelContext);
}
