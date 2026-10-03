import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';

const AdminStatsContext = createContext({
  pendingOrdersCount: 0,
  pendingReviewsCount: 0,
  ordersUnreadMessagesCount: 0,
  pendingReturnsCount: 0,
  pendingCallbackRequestsCount: 0,
  pendingLiveChatsCount: 0,
  outOfStockCount: 0,
  refreshStats: () => {},
});

export function AdminStatsProvider({ children }) {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [ordersUnreadMessagesCount, setOrdersUnreadMessagesCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [pendingCallbackRequestsCount, setPendingCallbackRequestsCount] = useState(0);
  const [pendingLiveChatsCount, setPendingLiveChatsCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);

  const refreshStats = useCallback(() => {
    adminApi.getStats()
      .then(({ data }) => {
        setPendingOrdersCount(data.stats?.pendingOrdersCount ?? 0);
        setPendingReviewsCount(data.stats?.pendingReviewsCount ?? 0);
        setOrdersUnreadMessagesCount(data.stats?.ordersUnreadMessagesCount ?? 0);
        setPendingReturnsCount(data.stats?.pendingReturnsCount ?? 0);
        setPendingCallbackRequestsCount(data.stats?.pendingCallbackRequestsCount ?? 0);
        setPendingLiveChatsCount(data.stats?.pendingLiveChatsCount ?? 0);
        setOutOfStockCount(data.stats?.outOfStockCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 60_000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  return (
    <AdminStatsContext.Provider
      value={{
        pendingOrdersCount,
        pendingReviewsCount,
        ordersUnreadMessagesCount,
        pendingReturnsCount,
        pendingCallbackRequestsCount,
        pendingLiveChatsCount,
        outOfStockCount,
        refreshStats,
      }}
    >
      {children}
    </AdminStatsContext.Provider>
  );
}

export function useAdminStats() {
  return useContext(AdminStatsContext);
}
