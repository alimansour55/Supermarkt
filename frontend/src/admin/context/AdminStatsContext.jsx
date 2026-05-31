import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';

const AdminStatsContext = createContext({
  pendingOrdersCount: 0,
  refreshStats: () => {},
});

export function AdminStatsProvider({ children }) {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const refreshStats = useCallback(() => {
    adminApi.getStats()
      .then(({ data }) => {
        setPendingOrdersCount(data.stats?.pendingOrdersCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 60_000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  return (
    <AdminStatsContext.Provider value={{ pendingOrdersCount, refreshStats }}>
      {children}
    </AdminStatsContext.Provider>
  );
}

export function useAdminStats() {
  return useContext(AdminStatsContext);
}
