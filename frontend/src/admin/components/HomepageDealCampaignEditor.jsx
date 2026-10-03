import { useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import { CalendarClock, ExternalLink, Layers, RefreshCw } from 'lucide-react';
import { adminApi } from '../adminApi';
import Input from '../../components/ui/Input';
import { DEAL_CAMPAIGN_MODES } from '../../utils/dealSectionShared';
import { formatScheduleRange, getPromotionTypeMeta, PROMOTION_STATUS_LABELS } from '../utils/promotionUtils';

function CampaignStatusPill({ status, isAr }) {
  const meta = PROMOTION_STATUS_LABELS[status] || PROMOTION_STATUS_LABELS.paused;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
      {isAr ? meta.ar : meta.en}
    </span>
  );
}

function CampaignOptionCard({
  campaign,
  isAr,
  selected,
  onSelect,
}) {
  const meta = getPromotionTypeMeta(campaign.type);
  const name = isAr ? campaign.nameAr : campaign.nameEn;
  const schedule = formatScheduleRange(campaign.startsAt, campaign.endsAt, isAr);
  const selectable = campaign.status !== 'ended';

  return (
    <button
      type="button"
      onClick={() => selectable && onSelect(campaign._id)}
      disabled={!selectable}
      className={`w-full rounded-xl border p-3 text-start transition ${
        !selectable
          ? 'cursor-not-allowed border-border bg-slate-50 opacity-60'
          : selected
            ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
            : 'border-border bg-white hover:border-orange-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {campaign.badgeAr || campaign.badgeEn}
            </span>
            <CampaignStatusPill status={campaign.status} isAr={isAr} />
            <span className="text-[10px] font-semibold text-text-muted">
              {meta.icon} {isAr ? meta.labelAr : meta.labelEn}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-text">{name}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
            <CalendarClock className="h-3 w-3 shrink-0" />
            {schedule}
          </p>
          <p className="mt-1 text-[10px] text-text-muted">
            {campaign.productCount ?? 0} {isAr ? 'منتج' : 'products'}
            {' · '}
            {isAr ? 'عرض محدود' : 'Limited time'}
          </p>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓
          </span>
        )}
      </div>
    </button>
  );
}

export default function HomepageDealCampaignEditor({
  isAr,
  form,
  onFieldChange,
  onConfigChange,
}) {
  const config = form.dealConfig || {};
  const mode = config.campaignMode || 'standalone';
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');

  const loadCampaigns = async () => {
    setLoading(true);
    setLoadError('');
    try {
      let rows = [];
      try {
        const { data } = await adminApi.getHomepageCampaignCandidates();
        rows = data.data || [];
      } catch {
        // fall through to promotions list
      }
      if (!rows.length) {
        const { data } = await adminApi.getPromotions({ schedule: 'limited', limit: 100 });
        rows = (data.data || []).filter((row) => row.status !== 'ended');
      }
      setCampaigns(rows);
      if (!rows.length) {
        setLoadError(isAr
          ? 'لا توجد حملات «عرض محدود» قابلة للربط — أنشئ حملة بتاريخ انتهاء من العروض والتخفيضات.'
          : 'No linkable limited-time campaigns — create one with an end date under Offers & promotions.');
      }
    } catch (err) {
      setCampaigns([]);
      setLoadError(err?.response?.data?.message || err?.message || (isAr ? 'تعذّر تحميل الحملات' : 'Failed to load campaigns'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'linked') loadCampaigns();
  }, [mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((row) =>
      [row.nameAr, row.nameEn, row.badgeAr, row.badgeEn].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [campaigns, query]);

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => String(row._id) === String(form.promotionId))
      || form.linkedPromotion
      || null,
    [campaigns, form.promotionId, form.linkedPromotion],
  );

  const setMode = (campaignMode) => {
    onConfigChange({
      ...config,
      campaignMode,
      countdownMode: campaignMode === 'linked' ? 'promotion' : (config.countdownMode === 'promotion' ? 'end_of_day' : config.countdownMode),
    });
    if (campaignMode === 'standalone') {
      onFieldChange({ promotionId: '' });
    }
  };

  const selectCampaign = (promotionId) => {
    onFieldChange({ promotionId });
    onConfigChange({
      ...config,
      campaignMode: 'linked',
      countdownMode: 'promotion',
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-4">
      <div className="flex items-start gap-3">
        <Layers className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-violet-950">
            {isAr ? 'ربط بحملة العروض' : 'Link to promotion campaign'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-violet-900/80">
            {isAr
              ? 'عروض اليوم متزامنة مع «العروض والتخفيضات» — اختر حملة محدودة أو أنشئ واحدة يدوياً عند الحفظ.'
              : 'Today\'s deals sync with Offers & promotions — pick a limited campaign or create one when you save manually.'}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {DEAL_CAMPAIGN_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setMode(item.value)}
            className={`rounded-xl border p-3 text-start transition ${
              mode === item.value
                ? 'border-violet-500 bg-violet-100 ring-2 ring-violet-200'
                : 'border-border bg-white hover:border-violet-200'
            }`}
          >
            <span className="text-lg" aria-hidden>{item.icon}</span>
            <p className="mt-1 text-xs font-bold text-text">{isAr ? item.labelAr : item.labelEn}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-text-muted">{isAr ? item.hintAr : item.hintEn}</p>
          </button>
        ))}
      </div>

      {mode === 'linked' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Input
                label={isAr ? 'بحث في الحملات' : 'Search campaigns'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? 'اسم الحملة أو الشارة...' : 'Campaign name or badge...'}
              />
            </div>
            <button
              type="button"
              onClick={loadCampaigns}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {isAr ? 'تحديث' : 'Refresh'}
            </button>
            <Link
              to="/admin/promotions"
              className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900 hover:bg-orange-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? 'إدارة الحملات' : 'Manage campaigns'}
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-violet-100/60" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
              {filtered.map((campaign) => (
                <CampaignOptionCard
                  key={campaign._id}
                  campaign={campaign}
                  isAr={isAr}
                  selected={String(form.promotionId) === String(campaign._id)}
                  onSelect={selectCampaign}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-violet-200 bg-white px-4 py-6 text-center">
              <p className="text-sm font-semibold text-text">
                {isAr ? 'لا توجد حملات محدودة للاختيار' : 'No limited campaigns to choose'}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {loadError || (isAr
                  ? 'أنشئ حملة «عرض محدود» (مع تاريخ انتهاء) من العروض والتخفيضات، أو استخدم الإعداد اليدوي.'
                  : 'Create a limited campaign (with end date) under Offers & promotions, or use manual setup.')}
              </p>
            </div>
          )}

          {!form.promotionId && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {isAr ? '⚠️ اختر حملة قبل الحفظ' : '⚠️ Select a campaign before saving'}
            </p>
          )}
        </div>
      )}

      {mode === 'standalone' && (
        <div className="space-y-3 rounded-xl border border-border bg-white p-3">
          <p className="text-xs font-semibold text-text">
            {isAr ? 'عند الحفظ' : 'On save'}
          </p>
          <p className="text-[11px] leading-relaxed text-text-muted">
            {isAr
              ? 'تُنشأ (أو تُحدَّث) حملة «عرض محدود» تلقائياً في العروض والتخفيضات بنفس المنتجات والمدة.'
              : 'A limited-time campaign is created or updated in Offers & promotions with the same products and schedule.'}
          </p>
          <Input
            label={isAr ? 'نسبة الخصم للحملة الجديدة (%)' : 'Discount for new campaign (%)'}
            type="number"
            min="1"
            max="99"
            value={config.discountPercent ?? 15}
            onChange={(e) => onConfigChange({
              ...config,
              discountPercent: Math.min(99, Math.max(1, Number(e.target.value) || 15)),
            })}
          />
        </div>
      )}

      {selectedCampaign && mode === 'linked' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">
              {isAr ? '✓ مرتبط:' : '✓ Linked:'}{' '}
              {isAr ? selectedCampaign.nameAr : selectedCampaign.nameEn}
            </p>
            <CampaignStatusPill status={selectedCampaign.status} isAr={isAr} />
          </div>
          <p className="mt-1 text-[11px] opacity-90">
            {formatScheduleRange(selectedCampaign.startsAt, selectedCampaign.endsAt, isAr)}
          </p>
          {selectedCampaign.status === 'scheduled' && (
            <p className="mt-1 text-[11px] text-blue-900">
              {isAr
                ? 'الحملة مجدولة — ستظهر في عروض اليوم عند بدء المدة.'
                : 'Campaign is scheduled — it will appear in today\'s deals when the window starts.'}
            </p>
          )}
        </div>
      )}

      {form.promotionId && mode === 'standalone' && form.linkedPromotion && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          {isAr
            ? `↪ مرتبط بحملة: ${form.linkedPromotion.nameAr}`
            : `↪ Synced campaign: ${form.linkedPromotion.nameEn}`}
        </div>
      )}
    </div>
  );
}
