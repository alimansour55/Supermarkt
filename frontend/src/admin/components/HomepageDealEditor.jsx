import { Clock, Flame } from 'lucide-react';
import Input from '../../components/ui/Input';
import {
  COUNTDOWN_MODES,
  DEAL_LAYOUTS,
  DEAL_STYLES,
  DEFAULT_DEAL_CONFIG,
  normalizeDealConfig,
  resolveDealCountdownEnd,
} from '../utils/dealShowcaseUtils';
import DealCountdown from '../../components/home/DealCountdown';
import HomepageProductSourceEditor from './HomepageProductSourceEditor';
import HomepageDealCampaignEditor from './HomepageDealCampaignEditor';

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HomepageDealEditor({
  isAr,
  form,
  categories = [],
  onConfigChange,
  onFieldChange,
  onQueryChange,
}) {
  const config = normalizeDealConfig(form.dealConfig || {}, form);
  const isLinked = config.campaignMode === 'linked';
  const previewEnd = resolveDealCountdownEnd({ ...form, dealConfig: config, type: form.type });

  const patchConfig = (patch) => {
    const next = normalizeDealConfig({ ...config, ...patch }, form);
    onConfigChange(next, next.layout);
    if (patch.style === 'flash') {
      onFieldChange({
        icon: form.icon || '⚡',
        titleAr: form.titleAr || 'تخفيضات سريعة',
        titleEn: form.titleEn || 'Flash sale',
      });
    }
    if (patch.style === 'standard' && !form.icon) {
      onFieldChange({ icon: '🔥' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <Flame className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="text-sm font-bold text-orange-950">
              {isAr ? 'عروض مع عدّاد' : 'Deals & countdown'}
            </p>
            <p className="mt-1 text-xs text-orange-900/80">
              {isAr
                ? 'عدّاد واضح + شبكة أو شريط — احفظ القسم لتطبيق التغييرات على الموقع.'
                : 'Visible countdown + grid or scroll — save the section to apply on the storefront.'}
            </p>
          </div>
        </div>
      </div>

      <HomepageDealCampaignEditor
        isAr={isAr}
        form={form}
        onFieldChange={onFieldChange}
        onConfigChange={(next) => onConfigChange(next, next.layout)}
      />

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نمط القسم' : 'Section style'}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEAL_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => patchConfig({
                style: style.value,
                showCountdown: style.value !== 'minimal',
              })}
              className={`rounded-xl border p-3 text-start transition ${
                config.style === style.value
                  ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                  : 'border-border hover:border-orange-200'
              }`}
            >
              <span className="text-xl">{style.icon}</span>
              <p className="mt-1 text-xs font-bold text-text">{isAr ? style.labelAr : style.labelEn}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">{isAr ? style.hintAr : style.hintEn}</p>
            </button>
          ))}
        </div>
      </div>

      {config.style !== 'minimal' && !isLinked && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <Clock className="h-4 w-4 text-orange-600" />
            {isAr ? 'العدّاد التنازلي' : 'Countdown timer'}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showCountdown}
              onChange={(e) => patchConfig({ showCountdown: e.target.checked })}
            />
            {isAr ? 'إظهار العدّاد على الموقع' : 'Show countdown on storefront'}
          </label>

          {config.showCountdown && (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'متى ينتهي العرض؟' : 'When does the deal end?'}</p>
                <div className="flex flex-col gap-2">
                  {COUNTDOWN_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => patchConfig({ countdownMode: mode.value })}
                      className={`rounded-lg border px-3 py-2 text-start text-xs ${
                        config.countdownMode === mode.value
                          ? 'border-orange-400 bg-orange-50 font-semibold text-orange-900'
                          : 'border-border hover:border-orange-200'
                      }`}
                    >
                      {isAr ? mode.labelAr : mode.labelEn}
                      <span className="mt-0.5 block text-[10px] font-normal text-text-muted">
                        {isAr ? mode.hintAr : mode.hintEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {config.countdownMode === 'duration' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[2, 4, 6, 12, 24].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => patchConfig({ countdownDurationHours: hours })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          config.countdownDurationHours === hours
                            ? 'bg-orange-600 text-white'
                            : 'border border-border bg-white hover:border-orange-300'
                        }`}
                      >
                        {isAr ? `${hours} س` : `${hours}h`}
                      </button>
                    ))}
                  </div>
                  <Input
                    label={isAr ? 'المدة (ساعات)' : 'Duration (hours)'}
                    type="number"
                    min={1}
                    max={72}
                    value={config.countdownDurationHours}
                    onChange={(e) => patchConfig({ countdownDurationHours: Number(e.target.value) || 6 })}
                  />
                  <p className="text-[11px] text-text-muted">
                    {isAr
                      ? 'يُحفظ وقت الانتهاء عند حفظ القسم — العدّاد على الموقع يطابق هذه المدة.'
                      : 'End time is fixed when you save — the storefront countdown matches this duration.'}
                  </p>
                </div>
              )}

              {config.countdownMode === 'custom' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{isAr ? 'تاريخ ووقت الانتهاء' : 'End date & time'}</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
                    value={toDatetimeLocalValue(config.countdownEnd)}
                    onChange={(e) => patchConfig({
                      countdownEnd: e.target.value ? new Date(e.target.value).toISOString() : '',
                    })}
                  />
                </div>
              )}

              {previewEnd && (
                <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-orange-800">
                    {isAr ? 'معاينة العدّاد' : 'Countdown preview'}
                  </p>
                  <DealCountdown
                    endDate={previewEnd}
                    variant={config.style === 'flash' ? 'flash' : 'prominent'}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {config.style !== 'minimal' && isLinked && config.showCountdown && previewEnd && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-orange-800">
            {isAr ? 'عدّاد من الحملة' : 'Countdown from campaign'}
          </p>
          <DealCountdown
            endDate={previewEnd}
            variant={config.style === 'flash' ? 'flash' : 'prominent'}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'عرض المنتجات' : 'Product layout'}</p>
        <div className="flex flex-wrap gap-2">
          {DEAL_LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() => patchConfig({ layout: layout.value })}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                config.layout === layout.value
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'border border-border hover:border-orange-300'
              }`}
            >
              {isAr ? layout.labelAr : layout.labelEn}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-text-muted">
          {config.layout === 'grid'
            ? (isAr ? '✓ شبكة — بطاقات منتجات عادية' : '✓ Grid — normal product cards')
            : (isAr ? '↔ شريط أفقي قابل للتمرير' : '↔ Horizontal scroll strip')}
        </p>
      </div>

      {config.layout === 'grid' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">{isAr ? 'أعمدة الشبكة' : 'Grid columns'}</p>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patchConfig({ columns: n })}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  config.columns === n ? 'bg-orange-600 text-white' : 'border border-border'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.showSubtitle}
            onChange={(e) => patchConfig({ showSubtitle: e.target.checked })}
          />
          {isAr ? 'إظهار الوصف الفرعي' : 'Show subtitle'}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.showViewAll}
            onChange={(e) => patchConfig({ showViewAll: e.target.checked })}
          />
          {isAr ? 'رابط «عرض الكل»' : '“View all” link'}
        </label>
      </div>

      <HomepageProductSourceEditor
        isAr={isAr}
        form={form}
        categories={categories}
        onQueryChange={onQueryChange}
        onFieldChange={onFieldChange}
        accent="orange"
        readOnly={isLinked}
        readOnlyHint={isAr
          ? 'المنتجات تُجلب من الحملة المرتبطة — عدّلها من العروض والتخفيضات.'
          : 'Products come from the linked campaign — edit them under Offers & promotions.'}
      />
    </div>
  );
}

export { DEFAULT_DEAL_CONFIG };
