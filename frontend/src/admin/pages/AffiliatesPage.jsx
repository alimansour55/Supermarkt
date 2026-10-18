import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, Check, Clock, Gift, MousePointerClick, Pause, Play, Save, Search, ShoppingBag, Users, Wallet,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader, Pagination, useConfirm, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';

/** Keep in sync with backend DEFAULT_AFFILIATE_SETTINGS (utils/affiliateRules.js). */
const DEFAULT_SETTINGS = {
  enabled: false,
  joinMode: 'open',
  rewardType: 'wallet',
  calcType: 'percent',
  percent: 3,
  fixedAmount: 20,
  maxRewardPerOrder: 100,
  minOrderTotal: 100,
  holdDays: 7,
  attributionDays: 7,
  newCustomersOnly: false,
  maxRewardedOrdersPerBuyer: 0,
  termsAr: '',
  termsEn: '',
};
const NUMBER_FIELDS = ['percent', 'fixedAmount', 'maxRewardPerOrder', 'minOrderTotal', 'holdDays', 'attributionDays', 'maxRewardedOrdersPerBuyer'];
const PREVIEW_ORDER = 500;

const LINK_STATUS = {
  active: { ar: 'يعمل', en: 'Active', cls: 'bg-emerald-50 text-emerald-700' },
  pending: { ar: 'بانتظار موافقتك', en: 'Waiting for you', cls: 'bg-amber-50 text-amber-800' },
  paused: { ar: 'متوقف', en: 'Paused', cls: 'bg-slate-100 text-slate-700' },
  blocked: { ar: 'محظور', en: 'Blocked', cls: 'bg-red-50 text-red-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-50 text-red-700' },
};
const REWARD_STATUS = {
  pending: { ar: 'لم يُسلَّم بعد', en: 'Not delivered yet', cls: 'bg-slate-100 text-slate-700' },
  holding: { ar: 'مدة الإرجاع', en: 'Return window', cls: 'bg-amber-50 text-amber-800' },
  paid: { ar: 'تم الدفع', en: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-50 text-red-700' },
  reversed: { ar: 'استُرجع', en: 'Taken back', cls: 'bg-red-50 text-red-700' },
};

const fmtDate = (v, isAr) => (v
  ? new Date(v).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');
const rewardText = (amount, type, isAr) => (type === 'points' ? `${amount} ${isAr ? 'نقطة' : 'pts'}` : formatPrice(amount));

function Badge({ meta, isAr }) {
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{isAr ? meta.ar : meta.en}</span>;
}

function Choice({ checked, onChange, title, hint, name, value }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-primary-500 bg-primary-50/60' : 'border-border bg-white hover:border-primary-300'}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 accent-primary-600" />
      <span>
        <span className="block text-sm font-semibold text-text">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold text-text">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" aria-hidden />
    </label>
  );
}

function Stat({ Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted"><Icon className="h-4 w-4" aria-hidden />{label}</div>
      <p className="mt-2 text-xl font-bold tabular-nums text-text" dir="ltr">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function previewReward(s, pointValue) {
  const pv = Number(pointValue) || 0;
  const points = s.rewardType === 'points';
  const base = PREVIEW_ORDER;
  if (base < (Number(s.minOrderTotal) || 0)) return null;
  let cash = s.calcType === 'percent'
    ? base * ((Number(s.percent) || 0) / 100)
    : (points ? (Number(s.fixedAmount) || 0) * pv : Number(s.fixedAmount) || 0);
  const cap = Number(s.maxRewardPerOrder) || 0;
  if (cap > 0) cash = Math.min(cash, points ? cap * pv : cap);
  if (points) {
    const pts = pv > 0 ? Math.floor(cash / pv + 1e-9) : 0;
    return { amount: pts, cash: Math.round(pts * pv * 100) / 100 };
  }
  return { amount: Math.round(cash * 100) / 100, cash: Math.round(cash * 100) / 100 };
}

// ── Rules ───────────────────────────────────────────────────────────────

function RulesTab({ isAr, settings, setSettings, saved, pointValue, onSave, saving }) {
  const set = (key) => (value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const num = (key) => (e) => set(key)(e.target.value);
  const points = settings.rewardType === 'points';
  const preview = previewReward(settings, pointValue);
  const dirty = Object.keys(DEFAULT_SETTINGS).some((k) => String(settings[k]) !== String(saved[k]));
  const unit = points ? (isAr ? 'نقطة' : 'points') : 'EGP';

  return (
    <form onSubmit={onSave} className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <Toggle
          checked={settings.enabled}
          onChange={set('enabled')}
          label={isAr ? 'تشغيل شارك واكسب' : 'Turn on Share & earn'}
          hint={isAr
            ? 'كل عميل يحصل على رابط خاص. إذا اشترى أحد من رابطه وتم التوصيل، يكسب العميل مكافأة.'
            : 'Every customer gets their own link. When someone buys through it and the order is delivered, the customer earns a reward.'}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-text">{isAr ? 'ماذا يكسب العميل؟' : 'What does the customer earn?'}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice name="rewardType" value="wallet" checked={!points} onChange={() => set('rewardType')('wallet')}
            title={isAr ? 'فلوس في المحفظة' : 'Money in their wallet'}
            hint={isAr ? 'يدفع بها في طلباته القادمة.' : 'They spend it on their next orders.'} />
          <Choice name="rewardType" value="points" checked={points} onChange={() => set('rewardType')('points')}
            title={isAr ? 'نقاط مكافآت' : 'Reward points'}
            hint={isAr ? `بنفس قيمة نقاط المتجر (كل ${pointValue > 0 ? Math.round(1 / pointValue) : '—'} نقطة = 1 EGP).` : `Same value as store points (every ${pointValue > 0 ? Math.round(1 / pointValue) : '—'} points = EGP 1).`} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice name="calcType" value="percent" checked={settings.calcType === 'percent'} onChange={() => set('calcType')('percent')}
            title={isAr ? 'نسبة من قيمة الطلب' : 'A percent of the order'}
            hint={isAr ? 'على المنتجات فقط — بدون التوصيل.' : 'On products only — delivery not included.'} />
          <Choice name="calcType" value="fixed" checked={settings.calcType === 'fixed'} onChange={() => set('calcType')('fixed')}
            title={isAr ? 'مبلغ ثابت لكل طلب' : 'A fixed amount per order'} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.calcType === 'percent' ? (
            <Input type="number" min={0} max={100} step="0.1" label={isAr ? 'النسبة %' : 'Percent %'} value={settings.percent} onChange={num('percent')} />
          ) : (
            <Input type="number" min={0} step="0.5" label={isAr ? `المبلغ لكل طلب (${unit})` : `Amount per order (${unit})`} value={settings.fixedAmount} onChange={num('fixedAmount')} />
          )}
          <Input type="number" min={0} label={isAr ? `أقصى مكافأة للطلب (${unit}) — 0 بلا حد` : `Most per order (${unit}) — 0 = no limit`} value={settings.maxRewardPerOrder} onChange={num('maxRewardPerOrder')} />
        </div>
        <p className="rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-900">
          {preview
            ? (isAr
              ? `مثال: طلب بـ ${PREVIEW_ORDER} EGP ← يكسب صاحب الرابط ${rewardText(preview.amount, settings.rewardType, true)}${points ? ` (≈ ${formatPrice(preview.cash)})` : ''}.`
              : `Example: an EGP ${PREVIEW_ORDER} order → the link owner earns ${rewardText(preview.amount, settings.rewardType, false)}${points ? ` (≈ ${formatPrice(preview.cash)})` : ''}.`)
            : (isAr ? `مثال: طلب بـ ${PREVIEW_ORDER} EGP أقل من الحد الأدنى — لا مكافأة.` : `Example: an EGP ${PREVIEW_ORDER} order is under the minimum — no reward.`)}
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-text">{isAr ? 'القواعد' : 'Rules'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="number" min={0} label={isAr ? 'أقل قيمة طلب (EGP)' : 'Smallest order (EGP)'} value={settings.minOrderTotal} onChange={num('minOrderTotal')} />
          <Input type="number" min={0} max={90} label={isAr ? 'انتظر بعد التوصيل (أيام)' : 'Wait after delivery (days)'} value={settings.holdDays} onChange={num('holdDays')} />
          <Input type="number" min={1} max={90} label={isAr ? 'تذكّر الرابط لمدة (أيام)' : 'Remember the link for (days)'} value={settings.attributionDays} onChange={num('attributionDays')} />
          <Input type="number" min={0} label={isAr ? 'أقصى طلبات مكافأة من نفس الصديق — 0 بلا حد' : 'Most rewarded orders per friend — 0 = no limit'} value={settings.maxRewardedOrdersPerBuyer} onChange={num('maxRewardedOrdersPerBuyer')} />
        </div>
        <p className="text-xs text-text-muted">
          {isAr
            ? 'الانتظار بعد التوصيل يحميك من المرتجعات: المكافأة تُضاف بعد انتهاء المدة فقط. الطلبات الملغاة أو المرتجعة لا تكسب، وطلبات العميل لنفسه من رابطه لا تُحتسب.'
            : 'Waiting after delivery protects you from returns: the reward is added only after the wait. Cancelled or returned orders earn nothing, and people can’t earn from their own orders.'}
        </p>
        <Toggle checked={settings.newCustomersOnly} onChange={set('newCustomersOnly')}
          label={isAr ? 'العملاء الجدد فقط' : 'New customers only'}
          hint={isAr ? 'المكافأة فقط عن أول طلب لعميل لم يشترِ من قبل.' : 'Reward only a first order from someone who never bought before.'} />
        <div>
          <p className="mb-2 text-sm font-semibold text-text">{isAr ? 'من يمكنه الحصول على رابط؟' : 'Who can get a link?'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice name="joinMode" value="open" checked={settings.joinMode === 'open'} onChange={() => set('joinMode')('open')}
              title={isAr ? 'أي عميل فوراً' : 'Any customer, right away'} />
            <Choice name="joinMode" value="approval" checked={settings.joinMode === 'approval'} onChange={() => set('joinMode')('approval')}
              title={isAr ? 'أوافق على كل شخص' : 'I approve each person'}
              hint={isAr ? 'مناسب للمؤثرين والشركاء.' : 'Good for influencers and partners.'} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">{isAr ? 'شروط إضافية (عربي)' : 'Extra terms (Arabic)'}</span>
            <textarea rows={3} dir="rtl" value={settings.termsAr} onChange={(e) => set('termsAr')(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">{isAr ? 'شروط إضافية (إنجليزي)' : 'Extra terms (English)'}</span>
            <textarea rows={3} dir="ltr" value={settings.termsEn} onChange={(e) => set('termsEn')(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </label>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty}>
          <Save className="h-4 w-4" aria-hidden />
          {isAr ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ── Links ───────────────────────────────────────────────────────────────

function DealEditor({ isAr, row, rewardType, onSave, onClose }) {
  const [mode, setMode] = useState(row.customCalcType || '');
  const [percent, setPercent] = useState(row.customPercent ?? '');
  const [fixed, setFixed] = useState(row.customFixedAmount ?? '');
  const [note, setNote] = useState(row.adminNote || '');
  const [saving, setSaving] = useState(false);
  const unit = rewardType === 'points' ? (isAr ? 'نقطة' : 'points') : 'EGP';

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        customCalcType: mode || null,
        customPercent: mode === 'percent' ? Number(percent) : null,
        customFixedAmount: mode === 'fixed' ? Number(fixed) : null,
        adminNote: note,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/40 p-3">
      <p className="text-xs font-semibold text-text">{isAr ? 'اتفاق خاص لهذا الشخص' : 'Special deal for this person'}</p>
      <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm">
        <option value="">{isAr ? 'نفس قواعد البرنامج' : 'Same as the program'}</option>
        <option value="percent">{isAr ? 'نسبة خاصة %' : 'Own percent %'}</option>
        <option value="fixed">{isAr ? `مبلغ ثابت خاص (${unit})` : `Own fixed amount (${unit})`}</option>
      </select>
      {mode === 'percent' && <Input type="number" min={0} max={100} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} label="%" />}
      {mode === 'fixed' && <Input type="number" min={0} value={fixed} onChange={(e) => setFixed(e.target.value)} label={unit} />}
      <Input value={note} onChange={(e) => setNote(e.target.value)} label={isAr ? 'ملاحظة داخلية' : 'Private note'} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
        <Button size="sm" onClick={save} loading={saving}>{isAr ? 'حفظ' : 'Save'}</Button>
      </div>
    </div>
  );
}

function LinksTab({ isAr, rewardType, onChanged, initialStatus = '' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listAffiliates({ status: status || undefined, search: query || undefined, page })
      .then(({ data }) => { setRows(data.data); setPagination(data.pagination); })
      .catch(() => toast.error(isAr ? 'تعذر تحميل الروابط' : 'Could not load links'))
      .finally(() => setLoading(false));
  }, [status, query, page, toast, isAr]);

  useEffect(() => { load(); }, [load]);

  const update = async (row, data, message) => {
    try {
      await adminApi.updateAffiliate(row.id, data);
      toast.success(message || (isAr ? 'تم الحفظ' : 'Saved'));
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save'));
      throw err;
    }
  };

  const setLinkStatus = async (row, next) => {
    if (next === 'blocked') {
      const ok = await confirm({
        title: isAr ? 'حظر هذا الرابط؟' : 'Block this link?',
        message: isAr ? 'لن تُحتسب طلبات جديدة منه. المكافآت المدفوعة تبقى كما هي.' : 'New orders through it won’t count. Rewards already paid stay as they are.',
        confirmLabel: isAr ? 'حظر' : 'Block',
        cancelLabel: isAr ? 'إلغاء' : 'Cancel',
        variant: 'danger',
      });
      if (!ok) return;
    }
    await update(row, { status: next }).catch(() => {});
  };

  const STATUS_TABS = [
    ['', isAr ? 'الكل' : 'All'],
    ['pending', isAr ? 'بانتظار موافقتك' : 'Waiting for you'],
    ['active', isAr ? 'تعمل' : 'Active'],
    ['paused', isAr ? 'متوقفة' : 'Paused'],
    ['blocked', isAr ? 'محظورة' : 'Blocked'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map(([value, label]) => (
          <button key={value || 'all'} type="button" onClick={() => { setStatus(value); setPage(1); }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${status === value ? 'border-primary-600 bg-primary-600 text-white' : 'border-border bg-white text-text hover:border-primary-300'}`}>
            {label}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} className="ms-auto flex min-w-[220px] flex-1 items-center gap-2 sm:flex-none">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? 'اسم، هاتف أو كود' : 'Name, phone or code'}
              className="w-full rounded-full border border-border bg-white py-2 pe-3 ps-9 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-text-muted">
          {isAr ? 'لا توجد روابط هنا بعد.' : 'No links here yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface/70 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'العميل' : 'Customer'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'الكود' : 'Code'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'فتحوا' : 'Opens'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'طلبات' : 'Orders'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'مبيعات' : 'Sales'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'دُفع له' : 'Paid out'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'المكافأة' : 'Rate'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text">{row.user?.name || '—'}</p>
                    <p className="text-xs text-text-muted" dir="ltr">{row.user?.phone || row.user?.email || ''}</p>
                    {row.adminNote && <p className="mt-1 max-w-[220px] text-[11px] text-violet-700">{row.adminNote}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold" dir="ltr">{row.code}</td>
                  <td className="px-4 py-3"><Badge meta={LINK_STATUS[row.status] || LINK_STATUS.paused} isAr={isAr} /></td>
                  <td className="px-4 py-3 text-end tabular-nums">{row.clicks}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{row.stats.orders}</td>
                  <td className="px-4 py-3 text-end tabular-nums" dir="ltr">{formatPrice(row.stats.sales)}</td>
                  <td className="px-4 py-3 text-end tabular-nums" dir="ltr">{rewardText(row.stats.paidReward, rewardType, isAr)}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.rate.calcType === 'percent'
                      ? `${row.rate.percent}%`
                      : rewardText(row.rate.fixedAmount, rewardType, isAr)}
                    {row.rate.custom && <span className="ms-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">{isAr ? 'خاص' : 'Special'}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {row.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => setLinkStatus(row, 'active')}><Check className="h-4 w-4" />{isAr ? 'موافقة' : 'Approve'}</Button>
                          <Button size="sm" variant="outline" onClick={() => setLinkStatus(row, 'rejected')}>{isAr ? 'رفض' : 'Reject'}</Button>
                        </>
                      )}
                      {row.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => setLinkStatus(row, 'paused')}><Pause className="h-4 w-4" />{isAr ? 'إيقاف' : 'Pause'}</Button>
                      )}
                      {['paused', 'blocked', 'rejected'].includes(row.status) && (
                        <Button size="sm" variant="outline" onClick={() => setLinkStatus(row, 'active')}><Play className="h-4 w-4" />{isAr ? 'تشغيل' : 'Turn on'}</Button>
                      )}
                      {row.status !== 'blocked' && (
                        <button type="button" onClick={() => setLinkStatus(row, 'blocked')} className="rounded-full p-2 text-red-600 hover:bg-red-50" title={isAr ? 'حظر' : 'Block'} aria-label={isAr ? 'حظر' : 'Block'}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(editing === row.id ? null : row.id)}>{isAr ? 'اتفاق خاص' : 'Deal'}</Button>
                    </div>
                    {editing === row.id && (
                      <div className="mt-2 min-w-[260px]">
                        <DealEditor isAr={isAr} row={row} rewardType={rewardType} onClose={() => setEditing(null)} onSave={(data) => update(row, data)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && <Pagination {...pagination} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}

// ── Rewards ─────────────────────────────────────────────────────────────

function RewardsTab({ isAr, onChanged, initialStatus = '' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page };
    if (status === 'clawback') params.clawbackFailed = 'true';
    else if (status) params.status = status;
    adminApi.listAffiliateCommissions(params)
      .then(({ data }) => { setRows(data.data); setPagination(data.pagination); })
      .catch(() => toast.error(isAr ? 'تعذر تحميل المكافآت' : 'Could not load rewards'))
      .finally(() => setLoading(false));
  }, [status, page, toast, isAr]);

  useEffect(() => { load(); }, [load]);

  const payNow = async (row) => {
    const ok = await confirm({
      title: isAr ? 'ادفع المكافأة الآن؟' : 'Pay this reward now?',
      message: isAr ? 'ستُضاف فوراً دون انتظار نهاية مدة الإرجاع.' : 'It is added right away, without waiting for the return window to end.',
      confirmLabel: isAr ? 'ادفع الآن' : 'Pay now',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    try {
      await adminApi.releaseAffiliateCommission(row.id);
      toast.success(isAr ? 'تم الدفع' : 'Paid');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الدفع' : 'Could not pay'));
    }
  };

  const cancel = async (row) => {
    const ok = await confirm({
      title: row.status === 'paid' ? (isAr ? 'استرجاع المكافأة؟' : 'Take this reward back?') : (isAr ? 'إلغاء المكافأة؟' : 'Cancel this reward?'),
      message: row.status === 'paid'
        ? (isAr ? 'سنخصمها من محفظته أو نقاطه إن كان الرصيد يكفي.' : 'We take it from their wallet or points if the balance is enough.')
        : (isAr ? 'لن يحصل صاحب الرابط على مكافأة عن هذا الطلب.' : 'The link owner won’t get a reward for this order.'),
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      cancelLabel: isAr ? 'رجوع' : 'Back',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await adminApi.cancelAffiliateCommission(row.id, { reason: 'Cancelled by the store' });
      toast.success(isAr ? 'تم' : 'Done');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الإلغاء' : 'Could not cancel'));
    }
  };

  const STATUS_TABS = [
    ['', isAr ? 'الكل' : 'All'],
    ['pending', REWARD_STATUS.pending[isAr ? 'ar' : 'en']],
    ['holding', REWARD_STATUS.holding[isAr ? 'ar' : 'en']],
    ['paid', REWARD_STATUS.paid[isAr ? 'ar' : 'en']],
    ['cancelled', REWARD_STATUS.cancelled[isAr ? 'ar' : 'en']],
    ['clawback', isAr ? 'لم نستطع استرجاعها' : 'Couldn’t take back'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(([value, label]) => (
          <button key={value || 'all'} type="button" onClick={() => { setStatus(value); setPage(1); }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${status === value ? 'border-primary-600 bg-primary-600 text-white' : 'border-border bg-white text-text hover:border-primary-300'}`}>
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-white p-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد مكافآت هنا.' : 'No rewards here.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface/70 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'الطلب' : 'Order'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'صاحب الرابط' : 'Link owner'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'المشتري' : 'Buyer'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'قيمة المنتجات' : 'Products'}</th>
                <th className="px-4 py-3 text-end font-semibold">{isAr ? 'المكافأة' : 'Reward'}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-bold" dir="ltr">#{row.orderNumber}</p>
                    <p className="text-[11px] text-text-muted">{fmtDate(row.createdAt, isAr)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.owner?.name || '—'}</p>
                    <p className="font-mono text-[11px] text-text-muted" dir="ltr">{row.code}</p>
                  </td>
                  <td className="px-4 py-3">{row.buyer?.name || '—'}</td>
                  <td className="px-4 py-3 text-end tabular-nums" dir="ltr">{formatPrice(row.baseAmount)}</td>
                  <td className="px-4 py-3 text-end font-bold tabular-nums" dir="ltr">{rewardText(row.rewardAmount, row.rewardType, isAr)}</td>
                  <td className="px-4 py-3">
                    <Badge meta={REWARD_STATUS[row.status] || REWARD_STATUS.pending} isAr={isAr} />
                    {row.status === 'holding' && row.holdUntil && (
                      <p className="mt-1 text-[11px] text-text-muted">{isAr ? 'يُدفع' : 'Pays'} {fmtDate(row.holdUntil, isAr)}</p>
                    )}
                    {row.clawbackFailed && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        {isAr ? 'الرصيد لم يكفِ للاسترجاع' : 'Balance too low to take back'}
                      </p>
                    )}
                    {row.note && ['cancelled', 'reversed'].includes(row.status) && <p className="mt-1 max-w-[200px] text-[11px] text-text-muted">{row.note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {row.status === 'holding' && <Button size="sm" variant="outline" onClick={() => payNow(row)}>{isAr ? 'ادفع الآن' : 'Pay now'}</Button>}
                      {['pending', 'holding', 'paid'].includes(row.status) && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(row)}>{row.status === 'paid' ? (isAr ? 'استرجاع' : 'Take back') : (isAr ? 'إلغاء' : 'Cancel')}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && <Pagination {...pagination} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function AffiliatesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [tab, setTab] = useState('rules');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(DEFAULT_SETTINGS);
  const [pointValue, setPointValue] = useState(0.1);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkFilter, setLinkFilter] = useState('');
  const [rewardFilter, setRewardFilter] = useState('');

  const loadOverview = useCallback(() => adminApi.getAffiliateOverview()
    .then(({ data }) => setOverview(data.data))
    .catch(() => setOverview(null)), []);

  useEffect(() => {
    Promise.all([
      adminApi.getAffiliateSettings().then(({ data }) => {
        const merged = { ...DEFAULT_SETTINGS, ...data.data };
        setSettings(merged);
        setSaved(merged);
        if (data.pointValueEGP != null) setPointValue(Number(data.pointValueEGP) || 0);
      }),
      loadOverview(),
    ])
      .catch(() => toast.error(isAr ? 'تعذر تحميل البيانات' : 'Could not load data'))
      .finally(() => setLoading(false));
  }, [isAr, toast, loadOverview]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...settings };
      NUMBER_FIELDS.forEach((k) => { payload[k] = Number(payload[k]) || 0; });
      const { data } = await adminApi.updateAffiliateSettings(payload);
      const merged = { ...DEFAULT_SETTINGS, ...data.data };
      setSettings(merged);
      setSaved(merged);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const c = overview?.commissions;
  const waitingCash = c ? (c.pending.cash + c.holding.cash) : 0;
  const orders = c ? (c.pending.count + c.holding.count + c.paid.count) : 0;
  const sales = c ? (c.pending.sales + c.holding.sales + c.paid.sales) : 0;
  const pendingLinks = overview?.affiliates?.pending || 0;

  const TABS = useMemo(() => [
    ['rules', isAr ? 'الإعدادات' : 'Settings'],
    ['links', `${isAr ? 'روابط العملاء' : 'Customer links'}${pendingLinks ? ` (${pendingLinks})` : ''}`],
    ['rewards', isAr ? 'المكافآت' : 'Rewards'],
  ], [isAr, pendingLinks]);

  if (loading) return <div className="flex justify-center py-20"><Loader /></div>;

  return (
    <PageHeader
      title={isAr ? 'شارك واكسب' : 'Share & earn'}
      description={isAr
        ? 'عملاؤك يسوّقون لمتجرك: كل عميل له رابط، ويكسب مكافأة عندما يشتري أحد من رابطه.'
        : 'Your customers market your store: each one gets a link and earns a reward when someone buys through it.'}
    >
      {!saved.enabled && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {isAr ? 'البرنامج متوقف — العملاء لا يرونه حتى تشغّله من الإعدادات.' : 'The program is off — customers can’t see it until you turn it on in Settings.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat Icon={Users} label={isAr ? 'روابط تعمل' : 'Active links'} value={overview?.affiliates?.active ?? 0}
          hint={pendingLinks ? (isAr ? `${pendingLinks} بانتظار موافقتك` : `${pendingLinks} waiting for you`) : undefined} />
        <Stat Icon={MousePointerClick} label={isAr ? 'مرات فتح الروابط' : 'Link opens'} value={overview?.clicks ?? 0} />
        <Stat Icon={ShoppingBag} label={isAr ? 'طلبات من الروابط' : 'Orders from links'} value={orders} hint={formatPrice(Math.round(sales * 100) / 100)} />
        <Stat Icon={Clock} label={isAr ? 'مكافآت قادمة' : 'Rewards coming'} value={formatPrice(Math.round(waitingCash * 100) / 100)} />
        <Stat Icon={saved.rewardType === 'points' ? Gift : Wallet} label={isAr ? 'دُفع للعملاء' : 'Paid to customers'} value={formatPrice(c?.paid.cash ?? 0)} />
      </div>

      {overview?.clawbackFailed > 0 && (
        <button type="button" onClick={() => { setRewardFilter('clawback'); setTab('rewards'); }}
          className="flex w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-start text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {isAr
            ? `${overview.clawbackFailed} مكافأة دُفعت ثم رُدّ الطلب ولم يكفِ الرصيد لاسترجاعها — اضغط للمراجعة.`
            : `${overview.clawbackFailed} paid rewards couldn’t be taken back after a refund (balance too low) — tap to review.`}
        </button>
      )}

      {overview?.topAffiliates?.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-text">{isAr ? 'أكثر من يبيع لك' : 'Your best sharers'}</p>
          <ul className="divide-y divide-border">
            {overview.topAffiliates.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{a.name || '—'}</span>
                  <span className="ms-2 font-mono text-xs text-text-muted" dir="ltr">{a.code}</span>
                </span>
                <span className="shrink-0 text-xs text-text-muted" dir="ltr">
                  {a.orders} {isAr ? 'طلب' : 'orders'} · {formatPrice(a.sales)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setTab(key); if (key === 'links' && pendingLinks && !linkFilter) setLinkFilter('pending'); }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-text-muted hover:text-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <RulesTab isAr={isAr} settings={settings} setSettings={setSettings} saved={saved} pointValue={pointValue} onSave={handleSave} saving={saving} />
      )}
      {tab === 'links' && <LinksTab key={`links-${linkFilter}`} isAr={isAr} rewardType={saved.rewardType} onChanged={loadOverview} initialStatus={linkFilter} />}
      {tab === 'rewards' && <RewardsTab key={`rewards-${rewardFilter}`} isAr={isAr} onChanged={loadOverview} initialStatus={rewardFilter} />}
    </PageHeader>
  );
}
