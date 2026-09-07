import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Package, Percent, Search, Tag, Truck, User, Warehouse } from 'lucide-react';
import CategoryMultiBrowsePicker from './CategoryMultiBrowsePicker';
import { adminApi } from '../adminApi';

const EMPTY_SCOPES = {
  products: [],
  categories: [],
  brands: [],
  fulfillmentLocations: [],
  deliveryZones: [],
  users: [],
  promotions: [],
};

function ScopeSection({ title, hint, icon: Icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen || count > 0);

  return (
    <div className="relative rounded-xl border border-border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <Icon className="h-4 w-4 shrink-0 text-primary-600" />
          {title}
          {count > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-800">
              {count}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" /> : <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />}
      </button>
      {open && (
        <div
          className="relative z-20 border-t border-border px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {hint && <p className="mb-3 text-xs leading-relaxed text-text-muted">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

function MultiIdSelect({
  options = [],
  value = [],
  onChange,
  isAr,
  labelKeyAr = 'nameAr',
  labelKeyEn = 'nameEn',
  fallbackKey = 'name',
  maxItems = 24,
  placeholderAr,
  placeholderEn,
  disabled = false,
  emptyAr = 'لا توجد خيارات متاحة',
  emptyEn = 'No options available',
  loading = false,
}) {
  const [filter, setFilter] = useState('');
  const selectedIds = useMemo(() => (value || []).map(String), [value]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const labelFor = (opt) => {
    if (!opt) return '';
    if (isAr) return opt[labelKeyAr] || opt[labelKeyEn] || opt[fallbackKey] || opt.slug || String(opt._id || opt.id);
    return opt[labelKeyEn] || opt[labelKeyAr] || opt[fallbackKey] || opt.slug || String(opt._id || opt.id);
  };

  const filteredAvailable = useMemo(() => {
    const available = options.filter((opt) => !selectedSet.has(String(opt._id || opt.id)));
    const q = filter.trim().toLowerCase();
    if (!q) return available;
    return available.filter((opt) => labelFor(opt).toLowerCase().includes(q));
  }, [options, selectedSet, filter, isAr, labelKeyAr, labelKeyEn, fallbackKey]);

  const addId = (id) => {
    const sid = String(id);
    if (!sid || selectedSet.has(sid) || selectedIds.length >= maxItems || disabled) return;
    onChange([...selectedIds, sid]);
    setFilter('');
  };

  const removeId = (id) => {
    if (disabled) return;
    onChange(selectedIds.filter((item) => item !== String(id)));
  };

  if (loading) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-4 text-center text-xs text-text-muted">
        {isAr ? 'جاري التحميل...' : 'Loading...'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const opt = options.find((o) => String(o._id || o.id) === id);
            return (
              <li key={id}>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-950">
                  <span className="truncate">{labelFor(opt) || id}</span>
                  {!disabled && (
                    <button type="button" onClick={() => removeId(id)} className="shrink-0 text-emerald-700 hover:text-red-600">×</button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-4 text-center text-xs text-text-muted">
          {isAr ? emptyAr : emptyEn}
        </p>
      ) : (
        <>
          {options.length > 8 && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={isAr ? 'تصفية القائمة...' : 'Filter list...'}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          )}
          <select
            value=""
            onChange={(e) => { if (e.target.value) addId(e.target.value); }}
            disabled={disabled || !filteredAvailable.length || selectedIds.length >= maxItems}
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{isAr ? placeholderAr : placeholderEn}</option>
            {filteredAvailable.map((opt) => (
              <option key={opt._id || opt.id} value={opt._id || opt.id}>{labelFor(opt)}</option>
            ))}
          </select>
        </>
      )}
      {selectedIds.length >= maxItems && (
        <p className="text-xs text-amber-700">{isAr ? `الحد الأقصى: ${maxItems}` : `Maximum: ${maxItems}`}</p>
      )}
    </div>
  );
}

function SimpleProductPicker({ value = [], onChange, isAr, canEdit, maxItems = 48 }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [labels, setLabels] = useState({});
  const [searching, setSearching] = useState(false);
  const selectedIds = useMemo(() => (value || []).map(String), [value]);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data: res } = await adminApi.searchPartnerRevenueProducts({ q, limit: 20 });
      const items = res.data || [];
      setResults(items.filter((p) => !selectedIds.includes(String(p._id))));
      setLabels((prev) => {
        const next = { ...prev };
        items.forEach((p) => {
          next[String(p._id)] = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
        });
        return next;
      });
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [selectedIds, isAr]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const add = (product) => {
    const id = String(product._id);
    if (!id || selectedIds.includes(id) || selectedIds.length >= maxItems) return;
    onChange([...selectedIds, id]);
    setLabels((prev) => ({
      ...prev,
      [id]: isAr ? (product.nameAr || product.nameEn) : (product.nameEn || product.nameAr),
    }));
    setQuery('');
    setResults([]);
  };

  const remove = (id) => onChange(selectedIds.filter((x) => x !== String(id)));

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <li key={id}>
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-950">
                <Package className="h-3 w-3 shrink-0" />
                <span className="truncate">{labels[id] || id.slice(-8)}</span>
                {canEdit && (
                  <button type="button" onClick={() => remove(id)} className="shrink-0 hover:text-red-600">×</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && selectedIds.length < maxItems && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'اكتب حرفين على الأقل للبحث عن منتج...' : 'Type at least 2 characters to search...'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {searching && <p className="mt-1 text-xs text-text-muted">{isAr ? 'جاري البحث...' : 'Searching...'}</p>}
          {query.length >= 2 && !searching && results.length === 0 && (
            <p className="mt-1 text-xs text-text-muted">{isAr ? 'لا توجد منتجات بهذا الاسم' : 'No products found'}</p>
          )}
          {results.length > 0 && (
            <ul className="absolute z-[100] mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-xl">
              {results.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-slate-50"
                  >
                    <Package className="h-4 w-4 shrink-0 text-text-muted" />
                    <span>{isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserScopePicker({ value = [], onChange, isAr, canEdit, maxItems = 24 }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [labels, setLabels] = useState({});
  const [searching, setSearching] = useState(false);
  const selectedIds = useMemo(() => (value || []).map(String), [value]);

  const searchUsers = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data: res } = await adminApi.searchPartnerRevenueCustomers({ q, limit: 20 });
      const users = res.data || [];
      setResults(users.filter((u) => !selectedIds.includes(String(u._id || u.id))));
      setLabels((prev) => {
        const next = { ...prev };
        users.forEach((u) => {
          next[String(u._id || u.id)] = u.name || u.username || u.email || u.phone;
        });
        return next;
      });
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [selectedIds]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 350);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  const addUser = (user) => {
    const id = String(user._id || user.id);
    if (!id || selectedIds.includes(id) || selectedIds.length >= maxItems) return;
    onChange([...selectedIds, id]);
    setLabels((prev) => ({ ...prev, [id]: user.name || user.username || user.email || user.phone }));
    setQuery('');
    setResults([]);
  };

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-950">
                <User className="h-3 w-3" />
                <span>{labels[id] || id.slice(-8)}</span>
                {canEdit && (
                  <button type="button" onClick={() => onChange(selectedIds.filter((x) => x !== id))} className="hover:text-red-600">×</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && selectedIds.length < maxItems && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'اكتب حرفين على الأقل للبحث عن عميل...' : 'Type at least 2 characters to search...'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {searching && <p className="mt-1 text-xs text-text-muted">{isAr ? 'جاري البحث...' : 'Searching...'}</p>}
          {query.length >= 2 && !searching && results.length === 0 && (
            <p className="mt-1 text-xs text-text-muted">{isAr ? 'لا يوجد عملاء بهذا الاسم' : 'No customers found'}</p>
          )}
          {results.length > 0 && (
            <ul className="absolute z-[100] mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-xl">
              {results.map((u) => (
                <li key={u._id || u.id}>
                  <button type="button" onClick={() => addUser(u)}
                    className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-slate-50">
                    <span className="font-medium">{u.name || u.username}</span>
                    {(u.email || u.phone) && (
                      <span className="text-xs text-text-muted" dir="ltr">{u.email || u.phone}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const REVENUE_ROLE_OPTIONS = [
  {
    value: 'combined',
    labelAr: 'نسبة عامة + تخصيصات',
    labelEn: 'Pool % + assignments',
    descAr: 'نسبته من الإيراد العام + إيراد العناصر المُعيَّنة له',
    descEn: 'Pool % share + revenue from assigned items',
  },
  {
    value: 'assigned_only',
    labelAr: 'التخصيصات فقط',
    labelEn: 'Assignments only',
    descAr: 'فقط إيراد المنتجات/المناطق المُعيَّنة — بدون نسبة عامة',
    descEn: 'Only assigned items revenue — no pool %',
  },
  {
    value: 'pool_only',
    labelAr: 'النسبة العامة فقط',
    labelEn: 'Pool % only',
    descAr: 'نسبته من الإجمالي فقط — التخصيصات للتوثيق',
    descEn: 'Only pool % of total — assignments are notes',
  },
];

export default function PartnerScopeEditor({
  scopes = EMPTY_SCOPES,
  onChange,
  isAr,
  canEdit,
  catalogLoaded = false,
  categories = [],
  brands = [],
  deliveryZones = [],
  fulfillmentLocations = [],
  promotions = [],
  revenueRole = 'combined',
  onRevenueRoleChange,
  assignmentSharePercent = 100,
  onAssignmentSharePercentChange,
  fixedSharePercent,
}) {
  const current = { ...EMPTY_SCOPES, ...scopes };
  const patch = (key, nextValue) => onChange({ ...current, [key]: nextValue });
  const totalCount = Object.values(current).reduce((sum, list) => sum + (list?.length || 0), 0);
  const roleMeta = REVENUE_ROLE_OPTIONS.find((r) => r.value === revenueRole) || REVENUE_ROLE_OPTIONS[0];

  return (
    <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      {/* Revenue model for this partner */}
      <div className="rounded-xl border border-violet-300 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-violet-950">
          {isAr ? 'كيف يحصل هذا الشريك على الإيراد؟' : 'How does this partner earn?'}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {REVENUE_ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${revenueRole === opt.value ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-primary-200'}`}
            >
              <input
                type="radio"
                name="revenueRole"
                value={opt.value}
                checked={revenueRole === opt.value}
                disabled={!canEdit}
                onChange={() => onRevenueRoleChange?.(opt.value)}
                className="sr-only"
              />
              <p className="text-sm font-bold text-text">{isAr ? opt.labelAr : opt.labelEn}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{isAr ? opt.descAr : opt.descEn}</p>
            </label>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {isAr ? roleMeta.descAr : roleMeta.descEn}
          {revenueRole !== 'assigned_only' && fixedSharePercent != null && (
            <span className="mt-1 block font-bold text-primary-700">
              {isAr ? `النسبة العامة: ${fixedSharePercent}%` : `Pool share: ${fixedSharePercent}%`}
            </span>
          )}
        </div>
      </div>

      {(revenueRole === 'combined' || revenueRole === 'assigned_only') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-amber-950">
              {isAr ? 'نسبة إيراد التخصيصات %' : 'Assignment revenue share %'}
            </span>
            <p className="mb-2 text-xs text-amber-900/80">
              {isAr
                ? 'كم % من إيراد كل عنصر مُعيَّن يحصل عليه هذا الشريك (100 = كامل الإيراد)'
                : 'What % of each assigned item\'s revenue this partner gets (100 = full revenue)'}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                disabled={!canEdit}
                value={assignmentSharePercent ?? 100}
                onChange={(e) => onAssignmentSharePercentChange?.(Number(e.target.value))}
                className="flex-1 accent-amber-600"
              />
              <input
                type="number"
                min={1}
                max={100}
                disabled={!canEdit}
                value={assignmentSharePercent ?? 100}
                onChange={(e) => onAssignmentSharePercentChange?.(Number(e.target.value))}
                className="w-16 rounded-lg border border-border px-2 py-1 text-center text-sm"
              />
              <span className="text-sm font-bold">%</span>
            </div>
          </label>
        </div>
      )}

      {(revenueRole === 'combined' || revenueRole === 'assigned_only') && (
        <>
          <p className="text-sm font-bold text-violet-950">
            {isAr ? 'العناصر المُعيَّنة لهذا الشريك' : 'Items assigned to this partner'}
          </p>
          {totalCount > 0 && (
            <p className="text-xs font-semibold text-violet-800">
              {isAr ? `${totalCount} عنصر` : `${totalCount} item(s)`}
            </p>
          )}

          <ScopeSection
            title={isAr ? 'منتجات' : 'Products'}
            hint={isAr ? 'ابحث واختر المنتجات' : 'Search and select products'}
            icon={Package}
            count={current.products.length}
            defaultOpen={current.products.length > 0}
          >
            <SimpleProductPicker
              value={current.products}
              onChange={(next) => patch('products', next)}
              isAr={isAr}
              canEdit={canEdit}
            />
          </ScopeSection>

          <ScopeSection
            title={isAr ? 'أقسام' : 'Categories'}
            hint={isAr ? 'اختر من القائمة — يشمل الأقسام الفرعية' : 'Pick from list — includes subcategories'}
            icon={Tag}
            count={current.categories.length}
          >
            {!catalogLoaded ? (
              <p className="text-xs text-text-muted">{isAr ? 'جاري تحميل الأقسام...' : 'Loading categories...'}</p>
            ) : categories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-4 text-center text-xs text-text-muted">
                {isAr ? 'لا توجد أقسام — أضفها من صفحة الأقسام' : 'No categories — add them in Categories page'}
              </p>
            ) : (
              <CategoryMultiBrowsePicker
                categories={categories}
                value={current.categories}
                onChange={(next) => patch('categories', next)}
                isAr={isAr}
                maxItems={24}
              />
            )}
          </ScopeSection>

          <ScopeSection title={isAr ? 'علامات تجارية' : 'Brands'} icon={Tag} count={current.brands.length}>
            <MultiIdSelect
              options={brands}
              value={current.brands}
              onChange={(next) => patch('brands', next)}
              isAr={isAr}
              disabled={!canEdit}
              loading={!catalogLoaded}
              placeholderAr="— اختر علامة من القائمة —"
              placeholderEn="— Select brand from list —"
              emptyAr="لا توجد علامات — أضفها من قسم العلامات التجارية"
              emptyEn="No brands — add them in Brands section"
            />
          </ScopeSection>

          <ScopeSection title={isAr ? 'مناطق توصيل' : 'Delivery zones'} icon={MapPin} count={current.deliveryZones.length}>
            <MultiIdSelect
              options={deliveryZones}
              value={current.deliveryZones}
              onChange={(next) => patch('deliveryZones', next)}
              isAr={isAr}
              disabled={!canEdit}
              loading={!catalogLoaded}
              labelKeyAr="areaAr"
              labelKeyEn="areaEn"
              placeholderAr="— اختر منطقة من القائمة —"
              placeholderEn="— Select zone from list —"
              emptyAr="لا توجد مناطق — أضفها من مناطق التوصيل"
              emptyEn="No zones — add them in Delivery Zones"
            />
          </ScopeSection>

          <ScopeSection title={isAr ? 'مواقع شحن' : 'Fulfillment locations'} icon={Warehouse} count={current.fulfillmentLocations.length}>
            <MultiIdSelect
              options={fulfillmentLocations}
              value={current.fulfillmentLocations}
              onChange={(next) => patch('fulfillmentLocations', next)}
              isAr={isAr}
              disabled={!canEdit}
              loading={!catalogLoaded}
              fallbackKey="name"
              placeholderAr="— اختر موقع من القائمة —"
              placeholderEn="— Select location from list —"
              emptyAr="لا توجد مواقع شحن — أضفها من مواقع الشحن"
              emptyEn="No locations — add them in Fulfillment Locations"
            />
          </ScopeSection>

          <ScopeSection title={isAr ? 'عملاء' : 'Customers'} icon={User} count={current.users.length}>
            <UserScopePicker
              value={current.users}
              onChange={(next) => patch('users', next)}
              isAr={isAr}
              canEdit={canEdit}
            />
          </ScopeSection>

          <ScopeSection title={isAr ? 'عروض' : 'Promotions'} icon={Percent} count={current.promotions.length}>
            <MultiIdSelect
              options={promotions}
              value={current.promotions}
              onChange={(next) => patch('promotions', next)}
              isAr={isAr}
              disabled={!canEdit}
              loading={!catalogLoaded}
              placeholderAr="— اختر عرضاً من القائمة —"
              placeholderEn="— Select promotion from list —"
              emptyAr="لا توجد عروض نشطة — أضفها من العروض"
              emptyEn="No active promotions — add them in Promotions"
            />
          </ScopeSection>
        </>
      )}

      {revenueRole === 'pool_only' && (
        <p className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-3 text-xs text-text-muted">
          <Truck className="h-4 w-4 shrink-0" />
          {isAr
            ? 'هذا الشريك يحصل على نسبته العامة فقط — لا حاجة لتخصيص عناصر'
            : 'This partner only gets their pool % — no item assignments needed'}
        </p>
      )}

      {totalCount === 0 && revenueRole === 'assigned_only' && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {isAr ? '⚠ اختر عنصراً واحداً على الأقل — وضع «التخصيصات فقط» يتطلب تخصيصات' : '⚠ Pick at least one item — "Assignments only" mode requires assignments'}
        </p>
      )}
    </div>
  );
}
