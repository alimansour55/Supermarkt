import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Handshake,
  Map,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  BarChart3,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminPanel } from '../context/AdminPanelContext';
import { formatPrice } from '../../utils/formatters';
import { EmptyState } from '../components';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components';
import { hasPermission } from '../adminPermissions';
import PartnerScopeEditor from '../components/PartnerScopeEditor';
import PartnerPercentageBar, { equalizePercentages, partnerColor, partnerColorHex } from '../components/PartnerPercentageBar';
import PartnerAssignmentMap from '../components/PartnerAssignmentMap';
import PartnerPayoutsPanel from '../components/PartnerPayoutsPanel';

const PERIODS = [
  { value: '7d', labelEn: '7 days', labelAr: '7 أيام' },
  { value: '30d', labelEn: '30 days', labelAr: '30 يوماً' },
  { value: '90d', labelEn: '90 days', labelAr: '90 يوماً' },
  { value: 'mtd', labelEn: 'This month', labelAr: 'هذا الشهر' },
  { value: 'custom', labelEn: 'Custom range', labelAr: 'فترة مخصصة' },
];

const TABS = [
  { id: 'partners', labelAr: 'الشركاء والنسب', labelEn: 'Partners & shares', Icon: Users },
  { id: 'assignments', labelAr: 'خريطة التخصيص', labelEn: 'Assignment map', Icon: Map },
  { id: 'rules', labelAr: 'قواعد التوزيع', labelEn: 'Distribution rules', Icon: Settings2 },
  { id: 'report', labelAr: 'التقرير', labelEn: 'Report', Icon: BarChart3 },
  { id: 'payouts', labelAr: 'المستحقات والدفعات', labelEn: 'Payouts', Icon: Wallet },
];

const MODES = [
  {
    value: 'attribution',
    labelAr: 'تخصيص + نسب (موصى به)',
    labelEn: 'Assignment + % split (recommended)',
    descAr: 'الإيراد المُخصص يذهب مباشرة للشريك — الباقي يُقسّم حسب النسب',
    descEn: 'Assigned revenue goes directly to partner — remainder splits by %',
  },
  { value: 'fixed', labelAr: 'نسب ثابتة فقط', labelEn: 'Fixed % only', descAr: 'تقسيم كامل حسب النسب المحددة', descEn: 'Full split by set percentages' },
  { value: 'equal', labelAr: 'تساوي', labelEn: 'Equal split', descAr: 'نفس المبلغ لكل شريك', descEn: 'Same amount per partner' },
  { value: 'weighted', labelAr: 'حسب المساهمة', labelEn: 'By contribution', descAr: 'حسب المنتجات والمناطق والمبيعات', descEn: 'By products, locations, sales' },
  { value: 'hybrid', labelAr: 'مختلط', labelEn: 'Hybrid', descAr: 'نسبة أساسية + الباقي حسب المساهمة', descEn: 'Base % + remainder by contribution' },
];

const UNASSIGNED_POLICIES = [
  { value: 'percentage', labelAr: 'حسب نسب الشركاء', labelEn: 'By partner % shares' },
  { value: 'equal', labelAr: 'توزيع متساوٍ', labelEn: 'Split equally' },
  { value: 'weighted', labelAr: 'حسب المساهمة', labelEn: 'By contribution' },
  { value: 'platform', labelAr: 'يبقى للمنصة', labelEn: 'Keep for platform' },
];

const ATTRIBUTION_STREAMS = [
  { key: 'productSales', labelAr: 'مبيعات منتجات', labelEn: 'Product sales' },
  { key: 'zoneOrders', labelAr: 'طلبات مناطق', labelEn: 'Zone orders' },
  { key: 'zoneDeliveryFees', labelAr: 'رسوم توصيل', labelEn: 'Delivery fees' },
  { key: 'locationOrders', labelAr: 'طلبات مواقع شحن', labelEn: 'Location orders' },
  { key: 'customerOrders', labelAr: 'طلبات عملاء', labelEn: 'Customer orders' },
  { key: 'promotionSales', labelAr: 'مبيعات عروض', labelEn: 'Promotion sales' },
];

const REVENUE_BASES = [
  { value: 'total', labelAr: 'إجمالي الإيرادات', labelEn: 'Total revenue' },
  { value: 'productSales', labelAr: 'مبيعات المنتجات فقط', labelEn: 'Product sales only' },
  { value: 'grossProfit', labelAr: 'إجمالي الربح', labelEn: 'Gross profit' },
];

const FACTOR_META = [
  { key: 'products', labelAr: 'المنتجات', labelEn: 'Products' },
  { key: 'productSales', labelAr: 'مبيعات', labelEn: 'Sales' },
  { key: 'categories', labelAr: 'أقسام', labelEn: 'Categories' },
  { key: 'brands', labelAr: 'علامات', labelEn: 'Brands' },
  { key: 'fulfillmentLocations', labelAr: 'مواقع شحن', labelEn: 'Locations' },
  { key: 'deliveryZones', labelAr: 'مناطق', labelEn: 'Zones' },
  { key: 'promotions', labelAr: 'عروض', labelEn: 'Promotions' },
  { key: 'zoneOrders', labelAr: 'طلبات مناطق', labelEn: 'Zone orders' },
  { key: 'deliveryFees', labelAr: 'رسوم توصيل', labelEn: 'Delivery fees' },
];

const DEFAULT_WEIGHTS = {
  products: 10, productSales: 25, categories: 5, brands: 5,
  fulfillmentLocations: 15, deliveryZones: 15, promotions: 10, zoneOrders: 12, deliveryFees: 8,
};

const DEFAULT_FACTOR_ENABLED = Object.fromEntries(FACTOR_META.map((f) => [f.key, true]));
const DEFAULT_ATTRIBUTION_STREAMS = Object.fromEntries(ATTRIBUTION_STREAMS.map((s) => [s.key, true]));

const EMPTY_SCOPES = {
  products: [], categories: [], brands: [],
  fulfillmentLocations: [], deliveryZones: [], users: [], promotions: [],
};

function emptyPartner(sortOrder = 0) {
  return {
    userId: '',
    nameAr: '',
    nameEn: '',
    email: '',
    phone: '',
    notes: '',
    fixedSharePercent: null,
    baseSharePercent: null,
    assignmentSharePercent: 100,
    revenueRole: 'combined',
    weightMultiplier: 1,
    scopes: { ...EMPTY_SCOPES },
    isActive: true,
    sortOrder,
  };
}

function defaultSettings() {
  return {
    enabled: false,
    mode: 'attribution',
    revenueBasis: 'total',
    reservePercent: 0,
    unassignedPolicy: 'percentage',
    attributionStreams: { ...DEFAULT_ATTRIBUTION_STREAMS },
    weights: { ...DEFAULT_WEIGHTS },
    factorEnabled: { ...DEFAULT_FACTOR_ENABLED },
    partners: [],
  };
}

function scopeCount(scopes) {
  return Object.values(scopes || {}).reduce((s, list) => s + (list?.length || 0), 0);
}

function exportReportCsv(report, isAr) {
  if (!report?.partners?.length) return;
  const headers = isAr
    ? ['الشريك', 'النسبة %', 'المبلغ', 'مُخصص', 'مكافأة غير مُخصص']
    : ['Partner', 'Share %', 'Amount', 'Attributed', 'Unassigned bonus'];
  const rows = report.partners.map((p) => [
    isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr),
    p.sharePercent,
    p.amount,
    p.attributedAmount ?? '',
    p.unassignedBonus ?? '',
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `partner-revenue-${report.period?.periodKey || 'report'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PartnerRevenuePage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const toast = useToast();
  const { showRevenue, loading: panelLoading } = useAdminPanel();
  const canEdit = hasPermission(user, 'settings:write');

  const [tab, setTab] = useState('partners');
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState(defaultSettings());
  const [conflicts, setConflicts] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [catalog, setCatalog] = useState({
    categories: [], brands: [], deliveryZones: [], fulfillmentLocations: [], promotions: [], products: [], users: [],
  });
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');

  const loadReport = useCallback(async (showRefresh = false) => {
    if (!showRevenue) { setLoading(false); return; }
    if (period === 'custom' && (!customStart || !customEnd)) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = period === 'custom'
        ? { start: customStart, end: customEnd }
        : { period };
      const { data: res } = await adminApi.getPartnerRevenueDistribution(params);
      setReport(res.data);
    } catch { setReport(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [period, customStart, customEnd, showRevenue]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const { data: res } = await adminApi.getPartnerRevenueSettings();
      const loaded = { ...defaultSettings(), ...(res.data?.settings || res.data) };
      setSettings(loaded);
      setStaffOptions(res.data?.candidates || []);
      setConflicts(res.data?.conflicts || []);
      if (res.data?.catalog) {
        setCatalog({
          categories: res.data.catalog.categories || [],
          brands: res.data.catalog.brands || [],
          deliveryZones: res.data.catalog.deliveryZones || [],
          fulfillmentLocations: res.data.catalog.fulfillmentLocations || [],
          promotions: res.data.catalog.promotions || [],
          products: res.data.catalog.products || [],
          users: res.data.catalog.users || [],
        });
        setCatalogLoaded(true);
      }
    } catch {
      setSettings(defaultSettings());
      setStaffOptions([]);
      setConflicts([]);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const chartData = useMemo(() => {
    if (!report?.partners?.length) return [];
    return report.partners.map((p, i) => ({
      name: isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr),
      amount: p.amount,
      sharePercent: p.sharePercent,
      fill: partnerColorHex(i),
    }));
  }, [report, isAr]);

  const activePartners = useMemo(
    () => (settings.partners || []).filter((p) => p.isActive !== false),
    [settings.partners],
  );

  const showPercentBar = activePartners.length > 0;

  const filteredPartnerIndices = useMemo(() => {
    const list = settings.partners || [];
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return list.map((_, i) => i);
    return list
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => [p.nameAr, p.nameEn, p.email, p.phone]
        .some((v) => (v || '').toLowerCase().includes(q)))
      .map(({ i }) => i);
  }, [settings.partners, partnerSearch]);

  const handleSaveSettings = async () => {
    if (!canEdit) return;
    const active = (settings.partners || []).filter((p) => p.isActive !== false);
    const hasValid = active.some((p) => p.userId || p.nameAr?.trim() || p.nameEn?.trim());
    if (settings.enabled && !hasValid) {
      toast.error(isAr ? 'أضف شريكاً واحداً على الأقل' : 'Add at least one partner');
      return;
    }
    if (showPercentBar && active.length > 0) {
      const poolEligible = active.filter((p) => (p.revenueRole || 'combined') !== 'assigned_only');
      const total = poolEligible.reduce((s, p) => s + (Number(p.fixedSharePercent) || 0), 0);
      if (poolEligible.length > 0 && Math.abs(total - 100) > 0.05) {
        toast.error(isAr
          ? 'مجموع النسب العامة (للشركاء غير «التخصيصات فقط») يجب أن يساوي 100%'
          : 'Pool shares (excluding "assignments only" partners) must total 100%');
        return;
      }
    }
    setSaving(true);
    try {
      const { data: res } = await adminApi.updatePartnerRevenueSettings(settings);
      setSettings({ ...defaultSettings(), ...res.data });
      toast.success(isAr ? 'تم حفظ إعدادات الشركاء' : 'Partner settings saved');
      loadReport(true);
      loadSettings();
      setTab('report');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const updatePartner = (index, patch) => {
    setSettings((prev) => {
      const partners = [...(prev.partners || [])];
      partners[index] = { ...partners[index], ...patch };
      return { ...prev, partners };
    });
  };

  const addPartner = () => {
    const newIndex = (settings.partners || []).length;
    setSettings((prev) => {
      const partners = equalizePercentages([
        ...(prev.partners || []),
        emptyPartner(newIndex),
      ]);
      return { ...prev, partners, enabled: prev.enabled || partners.length > 0 };
    });
    setExpandedPartner(`new-${newIndex}`);
    toast.success(isAr ? 'حدّد النسبة ونوع الإيراد ثم احفظ' : 'Set share % and revenue type then save');
  };

  const removePartner = (index) => {
    setSettings((prev) => {
      const partners = equalizePercentages(
        (prev.partners || []).filter((_, i) => i !== index),
      );
      return { ...prev, partners };
    });
  };

  if (panelLoading || (loading && settingsLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!showRevenue) {
    return (
      <EmptyState
        title={isAr ? 'الإيرادات مخفية' : 'Revenue is hidden'}
        description={isAr ? 'فعّل «عرض الإيرادات» من إعدادات المتجر.' : 'Enable revenue in store settings.'}
      />
    );
  }

  const summary = report?.summary || {};

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-emerald-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Handshake className="h-7 w-7" />
              <h1 className="text-2xl font-bold">
                {isAr ? 'توزيع إيرادات الشركاء' : 'Partner revenue distribution'}
              </h1>
            </div>
            <p className="max-w-xl text-sm text-white/85">
              {isAr
                ? 'أضف الشركاء بنسبهم، خصّص المنتجات والمناطق والعملاء، وشاهد التقرير'
                : 'Add partners with shares, assign products/zones/customers, and view the report'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.enabled ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                {isAr ? 'مفعّل' : 'Active'}
              </span>
            ) : (
              <span className="rounded-full bg-amber-400/30 px-3 py-1 text-xs font-bold">
                {isAr ? 'غير مفعّل' : 'Disabled'}
              </span>
            )}
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              {activePartners.length} {isAr ? 'شريك' : 'partners'}
            </span>
            {conflicts.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/80 px-3 py-1 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflicts.length} {isAr ? 'تعارض' : 'conflicts'}
              </span>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -start-12 h-56 w-56 rounded-full bg-white/5" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-white p-1.5 shadow-sm">
        {TABS.map(({ id, labelAr, labelEn, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${tab === id ? 'bg-primary-600 text-white shadow-md' : 'text-text-muted hover:bg-slate-50'}`}
          >
            <Icon className="h-4 w-4" />
            {isAr ? labelAr : labelEn}
          </button>
        ))}
      </div>

      {/* ─── PARTNERS TAB ─── */}
      {tab === 'partners' && (
        <div className="space-y-6">
          {!settings.enabled && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50/60 px-6 py-5">
              <p className="font-bold text-primary-900">{isAr ? 'كيف يعمل التوزيع؟' : 'How does distribution work?'}</p>
              <ul className="mt-2 space-y-2 text-sm text-primary-800">
                <li><strong>{isAr ? 'النسبة العامة %' : 'Pool share %'}:</strong> {isAr ? 'حصة كل شريك من الإيراد غير المُخصص' : 'Each partner\'s share of unassigned revenue'}</li>
                <li><strong>{isAr ? 'تخصيص منتج/منطقة' : 'Assign product/zone'}:</strong> {isAr ? 'إيراد ذلك العنصر يذهب مباشرة للشريك المُعيَّن' : 'That item\'s revenue goes directly to the assigned partner'}</li>
                <li><strong>{isAr ? 'نسبة + تخصيص' : 'Pool % + assignments'}:</strong> {isAr ? 'الاثنان معاً — بدون ازدواجية' : 'Both apply — no double counting'}</li>
              </ul>
            </div>
          )}

          {showPercentBar && activePartners.length > 0 && (
            <PartnerPercentageBar
              partners={settings.partners}
              isAr={isAr}
              canEdit={canEdit}
              reservePercent={settings.reservePercent}
              onChange={(partners) => setSettings((s) => ({ ...s, partners }))}
            />
          )}

          {settingsLoading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-text">{isAr ? 'الشركاء' : 'Partners'}</h2>
                  <p className="text-sm text-text-muted">
                    {isAr ? 'كل شريك له نسبة من الإيراد + تخصيصات اختيارية' : 'Each partner has a revenue % + optional assignments'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(settings.partners || []).length > 4 && (
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={partnerSearch}
                        onChange={(e) => setPartnerSearch(e.target.value)}
                        placeholder={isAr ? 'بحث عن شريك...' : 'Search partners...'}
                        className="w-48 rounded-xl border border-border py-2.5 ps-9 pe-3 text-sm"
                      />
                    </div>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={addPartner}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      {isAr ? 'إضافة شريك' : 'Add partner'}
                    </button>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-primary-200 bg-white p-4 shadow-sm">
                <input
                  type="checkbox"
                  checked={settings.enabled === true}
                  disabled={!canEdit}
                  onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                  className="h-5 w-5 rounded text-primary-600"
                />
                <div>
                  <span className="font-semibold text-text">{isAr ? 'تفعيل توزيع الإيرادات' : 'Enable revenue distribution'}</span>
                  <p className="text-xs text-text-muted">{isAr ? 'يجب التفعيل لظهور التقرير' : 'Required for the report'}</p>
                </div>
              </label>

              {partnerSearch.trim() && filteredPartnerIndices.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-sm text-text-muted">
                  {isAr ? 'لا يوجد شركاء مطابقون للبحث' : 'No partners match your search'}
                </div>
              )}

              {filteredPartnerIndices.map((index) => {
                const partner = settings.partners[index];
                const pid = partner._id || partner.userId || `new-${index}`;
                const isOpen = expandedPartner === pid;
                const name = isAr ? (partner.nameAr || partner.nameEn || `شريك ${index + 1}`) : (partner.nameEn || partner.nameAr || `Partner ${index + 1}`);
                const scopes = partner.scopes || EMPTY_SCOPES;
                const assigned = scopeCount(scopes);

                return (
                  <div key={pid} className={`rounded-2xl border border-border bg-white shadow-sm ${isOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-slate-50/80 px-5 py-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${partnerColor(index)}`}>
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-text">{name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-text-muted">
                          {partner.fixedSharePercent != null && (
                            <span className="rounded-md bg-primary-100 px-2 py-0.5 font-bold text-primary-800">
                              {partner.fixedSharePercent}%
                            </span>
                          )}
                          {assigned > 0 && (
                            <span className="rounded-md bg-violet-100 px-2 py-0.5 font-bold text-violet-800">
                              {assigned} {isAr ? 'تخصيص' : 'assigned'}
                            </span>
                          )}
                          {partner.isActive === false && (
                            <span className="rounded-md bg-slate-200 px-2 py-0.5">{isAr ? 'غير نشط' : 'Inactive'}</span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[200px]">
                          <span className="shrink-0 text-xs font-bold text-text-muted">%</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.5}
                            value={partner.fixedSharePercent ?? 0}
                            onChange={(e) => updatePartner(index, { fixedSharePercent: Number(e.target.value) })}
                            className="min-w-0 flex-1 accent-primary-600"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={partner.fixedSharePercent ?? ''}
                            onChange={(e) => updatePartner(index, { fixedSharePercent: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-14 rounded-lg border border-border px-1 py-1 text-center text-sm"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedPartner(isOpen ? null : pid)}
                        className="rounded-lg p-2 text-text-muted hover:bg-white"
                      >
                        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => removePartner(index)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="space-y-4 p-5">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="block sm:col-span-2 lg:col-span-3">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'ربط بحساب فريق' : 'Link team account'}</span>
                            <select
                              value={partner.userId || ''}
                              disabled={!canEdit}
                              onChange={(e) => {
                                const selected = staffOptions.find((s) => String(s.id) === e.target.value);
                                updatePartner(index, {
                                  userId: e.target.value || '',
                                  nameAr: partner.nameAr || selected?.name || '',
                                  nameEn: partner.nameEn || selected?.name || '',
                                });
                              }}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <option value="">{isAr ? '— شريك خارجي —' : '— External partner —'}</option>
                              {staffOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</span>
                            <input type="text" disabled={!canEdit} value={partner.nameAr || ''}
                              onChange={(e) => updatePartner(index, { nameAr: e.target.value })}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</span>
                            <input type="text" disabled={!canEdit} value={partner.nameEn || ''}
                              onChange={(e) => updatePartner(index, { nameEn: e.target.value })}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                          </label>
                          {showPercentBar && (
                            <label className="block sm:col-span-2">
                              <span className="mb-1 block text-xs font-medium text-text-muted">
                                {isAr ? 'النسبة العامة من الإيراد %' : 'General pool share %'}
                              </span>
                              <p className="mb-1 text-[11px] text-text-muted">
                                {partner.revenueRole === 'assigned_only'
                                  ? (isAr ? 'لا تُستخدم في وضع «التخصيصات فقط»' : 'Not used in "Assignments only" mode')
                                  : (isAr ? 'حصته من الإيراد غير المُخصص (أو الإجمالي في وضع النسبة فقط)' : 'Share of unassigned revenue (or total in pool-only mode)')}
                              </p>
                              <input type="number" min={0} max={100} step={0.5} disabled={!canEdit || partner.revenueRole === 'assigned_only'}
                                value={partner.fixedSharePercent ?? ''}
                                onChange={(e) => updatePartner(index, { fixedSharePercent: e.target.value === '' ? null : Number(e.target.value) })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100" />
                            </label>
                          )}
                          <label className="block">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'البريد' : 'Email'}</span>
                            <input type="email" disabled={!canEdit} value={partner.email || ''}
                              onChange={(e) => updatePartner(index, { email: e.target.value })}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'الهاتف' : 'Phone'}</span>
                            <input type="text" disabled={!canEdit} value={partner.phone || ''}
                              onChange={(e) => updatePartner(index, { phone: e.target.value })}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                          </label>
                          {settings.mode === 'hybrid' && (
                            <label className="block">
                              <span className="mb-1 block text-xs text-text-muted">
                                {isAr ? 'النسبة الأساسية (مختلط) %' : 'Base share (hybrid) %'}
                              </span>
                              <input type="number" min={0} max={100} step={0.5} disabled={!canEdit}
                                value={partner.baseSharePercent ?? ''}
                                onChange={(e) => updatePartner(index, { baseSharePercent: e.target.value === '' ? null : Number(e.target.value) })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                            </label>
                          )}
                          {(settings.mode === 'weighted' || settings.mode === 'hybrid') && (
                            <label className="block">
                              <span className="mb-1 block text-xs text-text-muted">
                                {isAr ? 'مضاعف المساهمة' : 'Contribution multiplier'}
                              </span>
                              <input type="number" min={0.1} max={10} step={0.1} disabled={!canEdit}
                                value={partner.weightMultiplier ?? 1}
                                onChange={(e) => updatePartner(index, { weightMultiplier: Number(e.target.value) })}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                            </label>
                          )}
                          <label className="block sm:col-span-2 lg:col-span-3">
                            <span className="mb-1 block text-xs text-text-muted">{isAr ? 'ملاحظات داخلية' : 'Internal notes'}</span>
                            <textarea rows={2} disabled={!canEdit} value={partner.notes || ''}
                              onChange={(e) => updatePartner(index, { notes: e.target.value })}
                              placeholder={isAr ? 'ملاحظات خاصة بالفريق فقط...' : 'Team-only notes...'}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                          </label>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" disabled={!canEdit} checked={partner.isActive !== false}
                            onChange={(e) => updatePartner(index, { isActive: e.target.checked })}
                            className="h-4 w-4 rounded text-primary-600" />
                          {isAr ? 'شريك نشط' : 'Active partner'}
                        </label>

                        <PartnerScopeEditor
                          scopes={partner.scopes}
                          onChange={(scopes) => updatePartner(index, { scopes })}
                          isAr={isAr}
                          canEdit={canEdit}
                          catalogLoaded={catalogLoaded}
                          categories={catalog.categories}
                          brands={catalog.brands}
                          deliveryZones={catalog.deliveryZones}
                          fulfillmentLocations={catalog.fulfillmentLocations}
                          promotions={catalog.promotions}
                          revenueRole={partner.revenueRole || 'combined'}
                          onRevenueRoleChange={(role) => updatePartner(index, { revenueRole: role })}
                          assignmentSharePercent={partner.assignmentSharePercent ?? 100}
                          onAssignmentSharePercentChange={(v) => updatePartner(index, { assignmentSharePercent: v })}
                          fixedSharePercent={partner.fixedSharePercent}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {!(settings.partners || []).length && (
                <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center">
                  <Users className="mx-auto h-12 w-12 text-text-muted/30" />
                  <p className="mt-4 text-lg font-semibold text-text">{isAr ? 'لا يوجد شركاء بعد' : 'No partners yet'}</p>
                  {canEdit && (
                    <button type="button" onClick={addPartner}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">
                      <Plus className="h-4 w-4" />
                      {isAr ? 'إضافة أول شريك' : 'Add first partner'}
                    </button>
                  )}
                </div>
              )}

              {canEdit && (settings.partners || []).length > 0 && (
                <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                  <button type="button" onClick={() => setTab('report')}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-slate-50">
                    {isAr ? 'معاينة التقرير' : 'Preview report'}
                  </button>
                  <button type="button" onClick={handleSaveSettings} disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
                    <Save className="h-4 w-4" />
                    {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ ونشر' : 'Save & apply')}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ─── ASSIGNMENTS TAB ─── */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text">{isAr ? 'خريطة التخصيص' : 'Assignment map'}</h2>
            <p className="text-sm text-text-muted">
              {isAr
                ? 'كل عنصر مُخصص يُنسب إيراده مباشرة لشريكه — العناصر المتعارضة مُعلَّمة'
                : 'Each assigned item\'s revenue goes directly to its partner — conflicts are flagged'}
            </p>
          </div>
          <PartnerAssignmentMap
            partners={settings.partners}
            conflicts={conflicts}
            catalog={catalog}
            isAr={isAr}
          />
        </div>
      )}

      {/* ─── RULES TAB ─── */}
      {tab === 'rules' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{isAr ? 'قواعد التوزيع' : 'Distribution rules'}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block rounded-xl border border-border p-4">
                <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'طريقة التقسيم' : 'Split method'}</span>
                <select value={settings.mode || 'attribution'} disabled={!canEdit}
                  onChange={(e) => setSettings((s) => ({ ...s, mode: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{isAr ? m.labelAr : m.labelEn}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-muted">
                  {isAr ? MODES.find((m) => m.value === settings.mode)?.descAr : MODES.find((m) => m.value === settings.mode)?.descEn}
                </p>
              </label>
              <label className="block rounded-xl border border-border p-4">
                <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'أساس الحساب' : 'Revenue basis'}</span>
                <select value={settings.revenueBasis || 'total'} disabled={!canEdit}
                  onChange={(e) => setSettings((s) => ({ ...s, revenueBasis: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                  {REVENUE_BASES.map((b) => (
                    <option key={b.value} value={b.value}>{isAr ? b.labelAr : b.labelEn}</option>
                  ))}
                </select>
              </label>
              <label className="block rounded-xl border border-border p-4">
                <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'احتياطي المنصة %' : 'Platform reserve %'}</span>
                <input type="number" min={0} max={100} disabled={!canEdit}
                  value={settings.reservePercent ?? 0}
                  onChange={(e) => setSettings((s) => ({ ...s, reservePercent: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
              {settings.mode === 'attribution' && (
                <label className="block rounded-xl border border-border p-4">
                  <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'الإيراد غير المُخصص' : 'Unassigned revenue'}</span>
                  <select value={settings.unassignedPolicy || 'percentage'} disabled={!canEdit}
                    onChange={(e) => setSettings((s) => ({ ...s, unassignedPolicy: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                    {UNASSIGNED_POLICIES.map((p) => (
                      <option key={p.value} value={p.value}>{isAr ? p.labelAr : p.labelEn}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>

          {settings.mode === 'attribution' && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/30 p-6">
              <h2 className="mb-4 text-lg font-bold">{isAr ? 'مصادر الإيراد المُخصص' : 'Attributed revenue streams'}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ATTRIBUTION_STREAMS.map((stream) => (
                  <label key={stream.key} className="flex items-center gap-3 rounded-xl border border-border bg-white p-4">
                    <input type="checkbox" disabled={!canEdit}
                      checked={settings.attributionStreams?.[stream.key] !== false}
                      onChange={(e) => setSettings((s) => ({
                        ...s,
                        attributionStreams: { ...s.attributionStreams, [stream.key]: e.target.checked },
                      }))}
                      className="h-4 w-4 rounded text-primary-600" />
                    <span className="text-sm font-medium">{isAr ? stream.labelAr : stream.labelEn}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => setShowAdvancedRules((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-primary-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showAdvancedRules ? (isAr ? 'إخفاء الإعدادات المتقدمة' : 'Hide advanced') : (isAr ? 'إعدادات متقدمة (مساهمة)' : 'Advanced (contribution)')}
            {showAdvancedRules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvancedRules && (settings.mode === 'weighted' || settings.mode === 'hybrid') && (
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FACTOR_META.map((factor) => (
                  <div key={factor.key} className="rounded-xl border border-border p-4">
                    <label className="mb-2 flex items-center gap-2">
                      <input type="checkbox" disabled={!canEdit}
                        checked={settings.factorEnabled?.[factor.key] !== false}
                        onChange={(e) => setSettings((s) => ({
                          ...s,
                          factorEnabled: { ...s.factorEnabled, [factor.key]: e.target.checked },
                        }))}
                        className="h-4 w-4 rounded text-primary-600" />
                      <span className="text-sm font-medium">{isAr ? factor.labelAr : factor.labelEn}</span>
                    </label>
                    <input type="number" min={0} disabled={!canEdit || settings.factorEnabled?.[factor.key] === false}
                      value={settings.weights?.[factor.key] ?? DEFAULT_WEIGHTS[factor.key]}
                      onChange={(e) => setSettings((s) => ({
                        ...s,
                        weights: { ...s.weights, [factor.key]: Number(e.target.value) },
                      }))}
                      className="w-full rounded-lg border border-border px-3 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <button type="button" onClick={handleSaveSettings} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white">
                <Save className="h-4 w-4" />
                {isAr ? 'حفظ القواعد' : 'Save rules'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── REPORT TAB ─── */}
      {tab === 'report' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
                {PERIODS.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPeriod(p.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${period === p.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-50'}`}>
                    {isAr ? p.labelAr : p.labelEn}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm" />
                  <span className="text-text-muted">→</span>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => loadReport(true)} disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {isAr ? 'تحديث' : 'Refresh'}
              </button>
              {report?.partners?.length > 0 && (
                <button type="button" onClick={() => exportReportCsv(report, isAr)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              )}
            </div>
          </div>

          {!report?.enabled && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {isAr ? 'التوزيع غير مفعّل. أضف الشركاء وفعّل من تبويب الشركاء.' : 'Distribution disabled. Add partners and enable in Partners tab.'}
              <button type="button" onClick={() => setTab('partners')} className="mt-2 block font-semibold text-primary-700 underline">
                {isAr ? 'فتح الشركاء' : 'Open partners'}
              </button>
            </div>
          )}

          {!report ? (
            <EmptyState title={isAr ? 'تعذر تحميل التقرير' : 'Could not load report'} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: isAr ? 'إجمالي الإيرادات' : 'Total revenue', value: formatPrice(summary.totalRevenue || 0), sub: `${summary.totalOrders || 0} ${isAr ? 'طلب' : 'orders'}`, cls: 'border-border' },
                  { label: isAr ? 'احتياطي المنصة' : 'Platform reserve', value: formatPrice(summary.reserveAmount || 0), sub: `${summary.reservePercent || 0}%`, cls: 'border-amber-200 bg-amber-50/50' },
                  { label: isAr ? 'قابل للتوزيع' : 'Distributable', value: formatPrice(summary.distributable || 0), sub: '', cls: 'border-emerald-200 bg-emerald-50/50' },
                  { label: isAr ? 'الشركاء' : 'Partners', value: summary.partnerCount || 0, sub: summary.mode || '', cls: 'border-border' },
                ].map((card) => (
                  <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${card.cls}`}>
                    <p className="text-sm text-text-muted">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold text-text">{card.value}</p>
                    {card.sub && <p className="mt-0.5 text-xs text-text-muted">{card.sub}</p>}
                  </div>
                ))}
              </div>

              {report.attributionSummary?.hasScopes && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-5 py-4 text-sm text-violet-950">
                  {isAr
                    ? `إيراد مُخصص: ${formatPrice(report.attributionSummary.totalAttributed || 0)} — الباقي يُوزَّع حسب النسب`
                    : `Attributed revenue: ${formatPrice(report.attributionSummary.totalAttributed || 0)} — remainder split by %`}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold">{isAr ? 'حصة كل شريك' : 'Share per partner'}</h2>
                  {chartData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={95}
                            label={({ name, sharePercent }) => `${name} (${sharePercent}%)`}>
                            {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatPrice(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState title={isAr ? 'لا يوجد شركاء' : 'No partners'} />
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold">{isAr ? 'المبالغ المستحقة' : 'Amounts due'}</h2>
                  {chartData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => formatPrice(v)} />
                          <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                            {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState title={isAr ? 'لا توجد بيانات' : 'No data'} />
                  )}
                </section>
              </div>

              <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold">{isAr ? 'تفاصيل التوزيع' : 'Distribution details'}</h2>
                {report.partners?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-text-muted">
                        <tr>
                          <th className="px-4 py-3 text-start">{isAr ? 'الشريك' : 'Partner'}</th>
                          <th className="px-4 py-3 text-start">{isAr ? 'النسبة' : 'Share'}</th>
                          <th className="px-4 py-3 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                          <th className="px-4 py-3 text-start">{isAr ? 'مُخصص' : 'Attributed'}</th>
                          <th className="px-4 py-3 text-start">{isAr ? 'تفاصيل' : 'Details'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.partners.map((p, pi) => {
                          const pid = String(p.partnerId || p.userId);
                          const name = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
                          const isExpanded = expandedPartner === `report-${pid}`;
                          return (
                            <Fragment key={pid}>
                              <tr className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${partnerColor(pi)}`}>
                                      {name.charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                      <p className="font-medium">{name}</p>
                                      {p.isExternal && <span className="text-xs text-text-muted">{isAr ? 'خارجي' : 'External'}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-bold text-primary-700">{p.sharePercent}%</td>
                                <td className="px-4 py-3 font-bold text-emerald-700">{formatPrice(p.amount)}</td>
                                <td className="px-4 py-3 text-violet-700">
                                  {p.attributedAmount != null ? formatPrice(p.attributedAmount) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <button type="button" onClick={() => setExpandedPartner(isExpanded ? null : `report-${pid}`)}
                                    className="text-primary-600 hover:underline">
                                    {isExpanded ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'عرض' : 'Show')}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={5} className="px-4 py-4">
                                    {p.attributionDetail && (
                                      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {Object.entries(p.attributionDetail).filter(([k]) => k !== 'total').map(([key, value]) => (
                                          <div key={key} className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                                            <p className="text-xs text-text-muted">
                                              {isAr ? ATTRIBUTION_STREAMS.find((s) => s.key === key)?.labelAr : ATTRIBUTION_STREAMS.find((s) => s.key === key)?.labelEn}
                                            </p>
                                            <p className="mt-1 font-semibold text-violet-900">{formatPrice(value || 0)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {p.poolAmount > 0 && (
                                      <p className="text-xs text-primary-700">
                                        {isAr ? `حصة الإيراد العام: ${formatPrice(p.poolAmount)}` : `General pool share: ${formatPrice(p.poolAmount)}`}
                                      </p>
                                    )}
                                    {p.unassignedBonus > 0 && p.poolAmount == null && (
                                      <p className="text-xs text-amber-700">
                                        {isAr ? `حصة من الإيراد العام: ${formatPrice(p.unassignedBonus)}` : `General pool share: ${formatPrice(p.unassignedBonus)}`}
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={isAr ? 'لا يوجد شركاء' : 'No partners'}
                    action={(
                      <button type="button" onClick={() => setTab('partners')}
                        className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white">
                        {isAr ? 'إعداد الشركاء' : 'Set up partners'}
                      </button>
                    )}
                  />
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* ─── PAYOUTS TAB ─── */}
      {tab === 'payouts' && (
        <PartnerPayoutsPanel
          isAr={isAr}
          canEdit={canEdit}
          partners={settings.partners || []}
          toast={toast}
        />
      )}
    </div>
  );
}
