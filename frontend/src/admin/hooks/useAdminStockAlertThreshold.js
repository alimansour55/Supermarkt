import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import {
  DEFAULT_STOCK_THRESHOLD,
  readStockThreshold,
  writeStockThreshold,
} from '../utils/stockThreshold';

export function useAdminStockAlertThreshold() {
  const [threshold, setThresholdState] = useState(() => readStockThreshold());
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getStoreSettings()
      .then(({ data }) => {
        const n = Number(data.data?.adminStockAlertThreshold);
        if (Number.isFinite(n) && n >= 0) {
          const normalized = writeStockThreshold(n);
          setThresholdState(normalized);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const saveThreshold = useCallback(async (raw) => {
    const normalized = writeStockThreshold(raw);
    setThresholdState(normalized);
    setSaving(true);
    try {
      await adminApi.updateStoreSettingsJson({ adminStockAlertThreshold: normalized });
      return normalized;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    threshold,
    thresholdString: String(threshold ?? DEFAULT_STOCK_THRESHOLD),
    ready,
    saving,
    saveThreshold,
    setThresholdState,
  };
}
