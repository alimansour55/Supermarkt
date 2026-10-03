import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminPanel } from '../context/AdminPanelContext';
import { useToast } from '../components';
import { buildStoreSettingsSavePayload } from '../utils/storeSettingsPayload';
import { normalizeStoreSettings } from '../utils/storeSettingsDefaults';

export function useStoreSettingsForm() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const { refreshAdminPanel } = useAdminPanel();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [stampFile, setStampFile] = useState(null);
  // Top-level settings keys this form actually edited. Other admin tabs/pages
  // can change unrelated sections (e.g. SEO) concurrently — on save we only
  // send our own dirty fields and pull everything else fresh, so we never
  // clobber someone else's change with a stale snapshot from page load.
  const dirtyFieldsRef = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    adminApi.getStoreSettings()
      .then(({ data }) => {
        if (mounted) setSettings(normalizeStoreSettings(data.data));
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل الإعدادات' : 'Could not load settings'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const update = useCallback((field, value) => {
    dirtyFieldsRef.current.add(field);
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const updateNested = useCallback((group, field, value) => {
    dirtyFieldsRef.current.add(group);
    setSettings((prev) => (prev ? { ...prev, [group]: { ...prev[group], [field]: value } } : prev));
  }, []);

  const updateInvoice = useCallback((field, value) => {
    dirtyFieldsRef.current.add('invoice');
    setSettings((prev) => (prev ? { ...prev, invoice: { ...prev.invoice, [field]: value } } : prev));
  }, []);

  const updateInvoiceLabel = useCallback((field, value) => {
    dirtyFieldsRef.current.add('invoice');
    setSettings((prev) => (prev ? {
      ...prev,
      invoice: { ...prev.invoice, labels: { ...prev.invoice.labels, [field]: value } },
    } : prev));
  }, []);

  const updateInvoiceColumn = useCallback((field, value) => {
    dirtyFieldsRef.current.add('invoice');
    setSettings((prev) => (prev ? {
      ...prev,
      invoice: { ...prev.invoice, columns: { ...prev.invoice.columns, [field]: value } },
    } : prev));
  }, []);

  const updateInvoiceRows = useCallback((rows) => {
    dirtyFieldsRef.current.add('invoice');
    setSettings((prev) => (prev ? { ...prev, invoice: { ...prev.invoice, customRows: rows } } : prev));
  }, []);

  const save = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!settings) return false;
    setSaving(true);
    try {
      // Merge our edited fields onto the latest server state, not the snapshot
      // this page loaded with — another tab may have saved a different section
      // (e.g. SEO) since then, and we must not send that stale copy back.
      let base = settings;
      try {
        const { data } = await adminApi.getStoreSettings();
        const freshSettings = normalizeStoreSettings(data.data);
        base = { ...freshSettings };
        dirtyFieldsRef.current.forEach((key) => {
          base[key] = settings[key];
        });
      } catch {
        // couldn't refresh — fall back to saving our local snapshot as-is
      }

      const payload = buildStoreSettingsSavePayload(base);
      let response;

      if (logoFile || faviconFile || stampFile) {
        const form = new FormData();
        form.append('settings', JSON.stringify(payload));
        if (logoFile) form.append('logo', logoFile);
        if (faviconFile) form.append('favicon', faviconFile);
        if (stampFile) form.append('invoiceStamp', stampFile);
        response = await adminApi.updateStoreSettings(form);
      } else {
        response = await adminApi.updateStoreSettingsJson(payload);
      }

      const saved = normalizeStoreSettings(response.data.data);
      setSettings(saved);
      dirtyFieldsRef.current = new Set();
      setLogoFile(null);
      setFaviconFile(null);
      setStampFile(null);
      refreshAdminPanel();
      toast.success(isAr ? 'تم حفظ إعدادات المتجر' : 'Store settings saved');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save settings'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [faviconFile, isAr, logoFile, stampFile, refreshAdminPanel, settings, toast]);

  return {
    settings,
    loading,
    saving,
    save,
    update,
    updateNested,
    updateInvoice,
    updateInvoiceLabel,
    updateInvoiceColumn,
    updateInvoiceRows,
    logoFile,
    setLogoFile,
    faviconFile,
    setFaviconFile,
    stampFile,
    setStampFile,
    isAr,
  };
}
