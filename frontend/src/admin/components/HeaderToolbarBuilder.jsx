import { useMemo } from 'react';
import {
  ChevronDown, ChevronUp, GripVertical, Plus, Trash2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  HEADER_BUILTIN_KEYS,
  HEADER_BUILTIN_META,
  emptyCustomToolbarItem,
  normalizeToolbarItem,
  reindexHeaderToolbar,
} from '../../utils/headerToolbarConfig';
import { getToolbarIconComponent } from '../../components/layout/ToolbarIcon';
import { normalizeNavHref } from '../utils/navigationHelpers';
import HeaderToolbarIconPicker from './HeaderToolbarIconPicker';
import HeaderToolbarStylePicker from './HeaderToolbarStylePicker';
import LinkPresetSelect from './LinkPresetSelect';

const BUILTIN_ICON_KEYS = {
  categories: 'categories',
  favorites: 'favorites',
  account: 'account',
  cart: 'cart',
};

function zoneLabel(zone, isAr) {
  if (zone === 'start') {
    return isAr ? 'بجانب الشعار (يمين)' : 'Near logo (start)';
  }
  return isAr ? 'نهاية الهيدر (يسار)' : 'Header end';
}

export default function HeaderToolbarBuilder({ isAr, navigation, onChange }) {
  const items = useMemo(
    () => reindexHeaderToolbar(navigation.headerToolbar || []),
    [navigation.headerToolbar],
  );

  const usedBuiltinKeys = useMemo(
    () => new Set(items.filter((i) => HEADER_BUILTIN_KEYS.includes(i.itemKey)).map((i) => i.itemKey)),
    [items],
  );

  const commit = (nextItems) => {
    onChange({
      ...navigation,
      headerToolbar: reindexHeaderToolbar(nextItems),
    });
  };

  const updateItem = (index, patch) => {
    commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const moveItem = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const removeItem = (index) => {
    commit(items.filter((_, i) => i !== index));
  };

  const addBuiltin = (key) => {
    if (usedBuiltinKeys.has(key)) return;
    const meta = HEADER_BUILTIN_META[key];
    commit([
      ...items,
      normalizeToolbarItem({
        itemKey: key,
        zone: key === 'categories' ? 'start' : 'end',
        sortOrder: items.length,
        isActive: true,
        showLabel: true,
        labelAr: meta?.labelAr || '',
        labelEn: meta?.labelEn || '',
      }),
    ]);
  };

  const addCustomLink = () => {
    commit([...items, emptyCustomToolbarItem('start')]);
  };

  const applyPreset = (index, preset) => {
    const patch = {
      labelAr: preset.labelAr || '',
      labelEn: preset.labelEn || '',
      href: normalizeNavHref(preset.path),
      isExternal: preset.isExternal === true,
    };
    if (preset.path === '/products') {
      patch.icon = 'layout-grid';
      patch.variant = 'pill';
    }
    updateItem(index, patch);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-bold">{isAr ? 'شريط الهيدر (أيقونات وروابط)' : 'Header toolbar'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {isAr
            ? 'فعّل أو أخفِ المفضلة والسلة وكل الأقسام وتسجيل الدخول. انقل العناصر يميناً أو يساراً وأضف روابط مثل «كل المنتجات».'
            : 'Show or hide Favorites, Cart, All Categories, and Login. Move items to the start or end, and add links like All Products.'}
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3 text-xs text-text-muted">
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <span className="rounded-lg bg-white px-2 py-1 shadow-sm">{isAr ? 'الشعار' : 'Logo'}</span>
          <span className="text-primary-600">→</span>
          <span className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-primary-800">
            {isAr ? 'بجانب الشعار' : 'Start zone'}
          </span>
          <span className="rounded-lg bg-white px-2 py-1 shadow-sm flex-1 min-w-[80px]">
            {isAr ? 'البحث' : 'Search'}
          </span>
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
            {isAr ? 'نهاية الهيدر' : 'End zone'}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isBuiltin = HEADER_BUILTIN_KEYS.includes(item.itemKey);
          const meta = isBuiltin ? HEADER_BUILTIN_META[item.itemKey] : null;
          const PreviewIcon = getToolbarIconComponent(
            isBuiltin ? BUILTIN_ICON_KEYS[item.itemKey] : item.icon,
            item.itemKey,
          );

          return (
            <div
              key={`${item.itemKey}-${index}`}
              className={`rounded-xl border p-4 ${isBuiltin ? 'border-border' : 'border-primary-200 bg-primary-50/20'}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-text-muted" aria-hidden />
                  <PreviewIcon className="h-4 w-4 text-text-muted" />
                  <span className="text-sm font-semibold text-text">
                    {isBuiltin
                      ? (isAr ? meta.labelAr : meta.labelEn)
                      : (isAr ? 'رابط مخصص' : 'Custom link')}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-muted">
                    {zoneLabel(item.zone, isAr)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-lg p-1.5 hover:bg-surface" onClick={() => moveItem(index, -1)} aria-label="Up">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="rounded-lg p-1.5 hover:bg-surface" onClick={() => moveItem(index, 1)} aria-label="Down">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {!isBuiltin && (
                    <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    {isAr ? 'الموضع' : 'Position'}
                  </label>
                  <select
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={item.zone}
                    onChange={(e) => updateItem(index, { zone: e.target.value })}
                  >
                    <option value="start">{zoneLabel('start', isAr)}</option>
                    <option value="end">{zoneLabel('end', isAr)}</option>
                  </select>
                </div>

                {!isBuiltin && (
                  <>
                    <Input
                      label={isAr ? 'عربي' : 'Arabic'}
                      value={item.labelAr}
                      onChange={(e) => updateItem(index, { labelAr: e.target.value })}
                    />
                    <Input label="EN" value={item.labelEn} onChange={(e) => updateItem(index, { labelEn: e.target.value })} />
                    <Input
                      label="URL"
                      value={item.href}
                      onChange={(e) => updateItem(index, { href: normalizeNavHref(e.target.value) })}
                      placeholder="/products"
                    />
                  </>
                )}

                <div className="flex flex-wrap items-end gap-3 pb-2 lg:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.isActive !== false}
                      onChange={(e) => updateItem(index, { isActive: e.target.checked })}
                    />
                    {isAr ? 'نشط' : 'Active'}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.showLabel !== false}
                      onChange={(e) => updateItem(index, { showLabel: e.target.checked })}
                    />
                    {isAr ? 'إظهار النص' : 'Show label'}
                  </label>
                  {!isBuiltin && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.isExternal === true}
                        onChange={(e) => updateItem(index, { isExternal: e.target.checked })}
                      />
                      {isAr ? 'رابط خارجي' : 'External'}
                    </label>
                  )}
                </div>
              </div>

              {!isBuiltin && (
                <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                  <HeaderToolbarIconPicker
                    value={item.icon}
                    onChange={(icon) => updateItem(index, { icon })}
                    isAr={isAr}
                    sampleLabel={isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr)}
                  />
                  <HeaderToolbarStylePicker
                    value={item.variant}
                    onChange={(variant) => updateItem(index, { variant })}
                    isAr={isAr}
                    icon={item.icon}
                    sampleLabel={isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr)}
                  />
                  <LinkPresetSelect
                    href={item.href}
                    isAr={isAr}
                    onApply={(preset) => applyPreset(index, preset)}
                  />
                </div>
              )}

              {isBuiltin && meta && (
                <p className="mt-2 text-xs text-text-muted">
                  {isAr ? meta.descriptionAr : meta.descriptionEn}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {HEADER_BUILTIN_KEYS.filter((key) => !usedBuiltinKeys.has(key)).map((key) => (
          <Button key={key} type="button" size="sm" variant="secondary" onClick={() => addBuiltin(key)}>
            <Plus className="h-4 w-4" />
            {isAr ? HEADER_BUILTIN_META[key].labelAr : HEADER_BUILTIN_META[key].labelEn}
          </Button>
        ))}
        <Button type="button" size="sm" onClick={addCustomLink}>
          <Plus className="h-4 w-4" />
          {isAr ? 'رابط مخصص (مثل كل المنتجات)' : 'Custom link (e.g. All Products)'}
        </Button>
      </div>
    </section>
  );
}
