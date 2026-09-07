import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Filter, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { hasPermission } from '../adminPermissions';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { useToast } from './index';
import {
  DEFAULT_PRODUCT_FILTER_SETTINGS,
  PRODUCT_FILTER_SECTION_LABELS,
  PRODUCT_SOURCE_OPTION_IDS,
} from '../../constants/productFilterSettings';
import { normalizeProductFilterSettings } from '../../utils/productFilterSettings';

function moveItem(items, index, direction) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, i) => ({ ...item, sortOrder: i }));
}

export default function ProductFilterSettingsAdmin() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission(user, 'settings:write');

  const [filterSettings, setFilterSettings] = useState(DEFAULT_PRODUCT_FILTER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getStoreSettings()
      .then(({ data }) => {
        setFilterSettings(normalizeProductFilterSettings(data.data?.productFilterSettings || {}));
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل إعدادات الفلاتر' : 'Could not load filter settings'))
      .finally(() => setLoading(false));
  }, [isAr, toast]);

  const enabledSections = useMemo(
    () => filterSettings.sections.filter((section) => section.enabled !== false),
    [filterSettings.sections],
  );

  const updateSection = (index, patch) => {
    setFilterSettings((prev) => {
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  };

  const moveSection = (index, direction) => {
    setFilterSettings((prev) => ({
      ...prev,
      sections: moveItem(prev.sections, index, direction),
    }));
  };

  const updateSourceOption = (index, patch) => {
    setFilterSettings((prev) => {
      const sourceOptions = [...prev.sourceOptions];
      sourceOptions[index] = { ...sourceOptions[index], ...patch };
      return { ...prev, sourceOptions };
    });
  };

  const moveSourceOption = (index, direction) => {
    setFilterSettings((prev) => ({
      ...prev,
      sourceOptions: moveItem(prev.sourceOptions, index, direction),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = normalizeProductFilterSettings(filterSettings);
      const form = new FormData();
      form.append('settings', JSON.stringify({ productFilterSettings: normalized }));
      await adminApi.updateStoreSettings(form);
      setFilterSettings(normalized);
      toast.success(isAr ? 'تم حفظ إعدادات الفلاتر' : 'Filter settings saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-white p-6">
        <Loader />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-text">
              <Filter className="h-5 w-5 text-primary-600" />
              {isAr ? 'إعدادات فلاتر المنتجات' : 'Product filter settings'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr
                ? 'تحكم في أقسام الفلتر التي يراها العميل وترتيبها، وخيارات «نوع المنتج» مثل منتجاتنا.'
                : 'Control which filter sections customers see, their order, and product-type options like Our products.'}
            </p>
          </div>
          {canEdit && (
            <Button type="button" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
            </Button>
          )}
        </div>

        {!canEdit && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {isAr
              ? 'عرض فقط — يتطلب صلاحية إعدادات المتجر للتعديل.'
              : 'Read-only — store settings permission required to edit.'}
          </p>
        )}

        {enabledSections.length > 0 && (
          <div className="mb-5 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
            <p className="mb-2 text-xs font-semibold text-primary-800">
              {isAr ? 'معاينة ترتيب الأقسام للعميل' : 'Customer section order preview'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {enabledSections.map((section) => {
                const labels = PRODUCT_FILTER_SECTION_LABELS[section.id];
                return (
                  <span
                    key={section.id}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-primary-800 ring-1 ring-primary-100"
                  >
                    {isAr ? labels?.ar : labels?.en}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="mb-1 text-base font-bold text-text">
          {isAr ? 'أقسام الفلتر' : 'Filter sections'}
        </h3>
        <p className="mb-4 text-sm text-text-muted">
          {isAr
            ? 'فعّل أو عطّل كل قسم ورتّب ظهوره في الشريط الجانبي.'
            : 'Enable or disable each sidebar section and set its display order.'}
        </p>

        <div className="space-y-3">
          {filterSettings.sections.map((section, index) => {
            const labels = PRODUCT_FILTER_SECTION_LABELS[section.id] || { ar: section.id, en: section.id };
            return (
              <div
                key={section.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-50/60 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-text">{isAr ? labels.ar : labels.en}</p>
                  <p className="text-xs text-text-muted">{section.id}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={section.enabled !== false}
                        onChange={(e) => updateSection(index, { enabled: e.target.checked })}
                      />
                      {isAr ? 'ظاهر' : 'Visible'}
                    </label>
                    <button
                      type="button"
                      onClick={() => moveSection(index, -1)}
                      className="rounded-lg border border-border p-2 hover:bg-white"
                      aria-label={isAr ? 'أعلى' : 'Move up'}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, 1)}
                      className="rounded-lg border border-border p-2 hover:bg-white"
                      aria-label={isAr ? 'أسفل' : 'Move down'}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="mb-1 text-base font-bold text-text">
          {isAr ? 'خيارات نوع المنتج' : 'Product type options'}
        </h3>
        <p className="mb-4 text-sm text-text-muted">
          {isAr
            ? '«منتجاتنا» تعرض المنتجات الموسومة في لوحة المنتجات. يمكنك تخصيص التسميات وإخفاء الخيارات.'
            : '“Our products” shows items tagged in the product admin. Customize labels and visibility.'}
        </p>

        <div className="space-y-4">
          {filterSettings.sourceOptions.map((option, index) => {
            const isCore = PRODUCT_SOURCE_OPTION_IDS.includes(option.id);
            return (
              <div
                key={option.id}
                className="rounded-xl border border-border bg-slate-50/60 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-text">{option.id}</p>
                    {option.id === 'our_products' && (
                      <p className="text-xs text-primary-700">
                        {isAr ? 'يتطلب تفعيل «منتجنا» على المنتج' : 'Requires “Our product” tag on products'}
                      </p>
                    )}
                  </div>
                  {canEdit && isCore && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={option.enabled !== false}
                          onChange={(e) => updateSourceOption(index, { enabled: e.target.checked })}
                          disabled={option.id === 'all'}
                        />
                        {isAr ? 'ظاهر' : 'Visible'}
                      </label>
                      <button
                        type="button"
                        onClick={() => moveSourceOption(index, -1)}
                        className="rounded-lg border border-border p-2 hover:bg-white"
                        aria-label={isAr ? 'أعلى' : 'Move up'}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSourceOption(index, 1)}
                        className="rounded-lg border border-border p-2 hover:bg-white"
                        aria-label={isAr ? 'أسفل' : 'Move down'}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label={isAr ? 'التسمية (عربي)' : 'Label (Arabic)'}
                    value={option.labelAr}
                    onChange={(e) => updateSourceOption(index, { labelAr: e.target.value })}
                    disabled={!canEdit || option.id === 'all'}
                  />
                  <Input
                    label={isAr ? 'التسمية (English)' : 'Label (English)'}
                    value={option.labelEn}
                    onChange={(e) => updateSourceOption(index, { labelEn: e.target.value })}
                    disabled={!canEdit || option.id === 'all'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
