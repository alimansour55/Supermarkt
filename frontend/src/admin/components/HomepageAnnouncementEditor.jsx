import { Megaphone, Plus, Trash2 } from 'lucide-react';
import HomepageDestinationPicker from './HomepageDestinationPicker';
import {
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_PRESETS,
  ANNOUNCEMENT_STYLES,
  EMPTY_ANNOUNCEMENT_CONFIG,
  announcementStyleMeta,
  dateInputValue,
  formatAnnouncementPhaseLabel,
  getAnnouncementPhase,
  normalizeAnnouncementConfig,
} from '../utils/announcementUtils';
import { normalizeHomepageLink as normalizeLink } from '../utils/homepageSectionMeta';

function AnnouncementPreview({
  isAr,
  layout,
  icon,
  badge,
  message,
  cta,
  link,
  dismissible,
}) {
  const style = announcementStyleMeta(layout);
  const isBold = layout === 'bold';

  return (
    <div className={`relative flex flex-wrap items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-semibold ${style.previewClass}`}>
      {icon && <span className="text-base" aria-hidden>{icon}</span>}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isBold ? 'bg-white/20' : 'bg-primary-100 text-primary-800'}`}>
            {badge}
          </span>
        )}
        <span>{message || (isAr ? 'نص الإعلان يظهر هنا' : 'Announcement text preview')}</span>
        {link && cta && (
          <span className={`text-xs font-bold underline underline-offset-2 ${isBold ? 'opacity-95' : 'opacity-80'}`}>
            {cta}
          </span>
        )}
      </div>
      {dismissible && (
        <span className={`absolute top-2 ${isAr ? 'left-2' : 'right-2'} text-xs opacity-60`} aria-hidden>×</span>
      )}
    </div>
  );
}

function emptyRotateItem() {
  return { titleAr: '', titleEn: '', link: '/products', emoji: '📢' };
}

export default function HomepageAnnouncementEditor({
  isAr,
  categories = [],
  titleAr = '',
  titleEn = '',
  subtitleAr = '',
  subtitleEn = '',
  ctaLabelAr = '',
  ctaLabelEn = '',
  link = '',
  icon = '',
  layout = 'accent',
  items = [],
  announcementConfig,
  onFieldChange,
  onConfigChange,
  onItemsChange,
}) {
  const config = normalizeAnnouncementConfig(announcementConfig || EMPTY_ANNOUNCEMENT_CONFIG);
  const phase = getAnnouncementPhase(config);
  const runsForever = config.runsForever !== false;
  const isRotate = config.mode === 'rotate';
  const previewMessage = isAr ? titleAr || titleEn : titleEn || titleAr;
  const previewBadge = isAr ? subtitleAr || subtitleEn : subtitleEn || subtitleAr;
  const previewCta = isAr ? ctaLabelAr || 'المزيد ←' : ctaLabelEn || 'Learn more →';

  const patchConfig = (patch) => onConfigChange({ ...config, ...patch });

  const applyPreset = (preset) => {
    onFieldChange({
      titleAr: preset.titleAr,
      titleEn: preset.titleEn,
      ctaLabelAr: preset.ctaLabelAr,
      ctaLabelEn: preset.ctaLabelEn,
      link: preset.link,
      icon: preset.icon,
      layout: preset.layout,
    });
  };

  const rotateItems = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-4">
        <div className="flex items-start gap-3">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <div>
            <p className="text-sm font-bold text-sky-950">
              {isAr ? 'شريط إعلان — محرر مخصص' : 'Announcement bar — dedicated editor'}
            </p>
            <p className="mt-1 text-xs text-sky-900/80">
              {isAr
                ? 'رسالة قصيرة بارزة — ليس سلايدر ولا شبكة. مثالي للتوصيل المجاني، العروض، والتنبيهات.'
                : 'Short highlighted message — not a slider or grid. Ideal for free delivery, promos, and alerts.'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
          {isAr ? 'معاينة مباشرة' : 'Live preview'}
        </p>
        <AnnouncementPreview
          isAr={isAr}
          layout={layout || 'accent'}
          icon={icon}
          badge={!isRotate ? previewBadge : ''}
          message={previewMessage}
          cta={previewCta}
          link={link}
          dismissible={config.dismissible}
        />
        <p className="mt-2 text-center text-xs font-medium text-text-muted">
          {formatAnnouncementPhaseLabel(phase, isAr)}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'قوالب سريعة' : 'Quick presets'}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {ANNOUNCEMENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-xl border border-border bg-white p-3 text-start transition hover:border-sky-300 hover:bg-sky-50/40"
            >
              <span className="text-lg">{preset.icon}</span>
              <p className="mt-1 line-clamp-2 text-xs font-semibold">{isAr ? preset.titleAr : preset.titleEn}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نمط الشريط' : 'Bar style'}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {ANNOUNCEMENT_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onFieldChange({ layout: style.value })}
              className={`rounded-xl border p-3 text-start transition ${
                layout === style.value
                  ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-200'
                  : 'border-border bg-white hover:border-sky-200'
              }`}
            >
              <div className={`mb-2 rounded-lg border px-2 py-1.5 text-center text-[10px] font-bold ${style.previewClass}`}>
                {isAr ? style.labelAr : style.labelEn}
              </div>
              <p className="text-[11px] text-text-muted">{isAr ? style.descAr : style.descEn}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold text-text">{isAr ? 'نوع المحتوى' : 'Content type'}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchConfig({ mode: 'single' })}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${!isRotate ? 'bg-sky-600 text-white' : 'border border-border bg-white'}`}
            >
              {isAr ? 'رسالة واحدة' : 'Single message'}
            </button>
            <button
              type="button"
              onClick={() => patchConfig({ mode: 'rotate' })}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${isRotate ? 'bg-sky-600 text-white' : 'border border-border bg-white'}`}
            >
              {isAr ? 'رسائل متعددة (تتناوب)' : 'Rotating messages'}
            </button>
          </div>
        </div>
        {isRotate && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-text">
              {isAr ? 'مدة كل رسالة (ثوانٍ)' : 'Seconds per message'}
            </label>
            <input
              type="number"
              min="3"
              max="20"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={config.rotateSeconds}
              onChange={(e) => patchConfig({ rotateSeconds: Math.min(20, Math.max(3, Number(e.target.value) || 6)) })}
            />
          </div>
        )}
      </div>

      {!isRotate ? (
        <div className="space-y-4 rounded-xl border border-border bg-surface-muted/20 p-4">
          <p className="text-sm font-bold text-text">{isAr ? 'نص الإعلان' : 'Message'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'عربي' : 'Arabic'}</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={titleAr}
                onChange={(e) => onFieldChange({ titleAr: e.target.value })}
                placeholder={isAr ? 'مثال: توصيل مجاني...' : 'e.g. Free delivery...'}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'EN' : 'English'}</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={titleEn}
                onChange={(e) => onFieldChange({ titleEn: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'شارة صغيرة (اختياري)' : 'Small badge (optional)'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={subtitleAr}
                onChange={(e) => onFieldChange({ subtitleAr: e.target.value })}
                placeholder={isAr ? 'مثال: عرض محدود' : 'e.g. Limited offer'}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'Badge EN' : 'Badge EN'}</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={subtitleEn}
                onChange={(e) => onFieldChange({ subtitleEn: e.target.value })}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">{isAr ? 'أيقونة' : 'Icon'}</p>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onFieldChange({ icon: emoji })}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg ${icon === emoji ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200' : 'border-border bg-white'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نص الرابط (عربي)' : 'Link label (AR)'}</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={ctaLabelAr}
                onChange={(e) => onFieldChange({ ctaLabelAr: e.target.value })}
                placeholder={isAr ? 'تسوق الآن' : 'Shop now'}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'Link label (EN)' : 'Link label (EN)'}</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={ctaLabelEn}
                onChange={(e) => onFieldChange({ ctaLabelEn: e.target.value })}
              />
            </div>
          </div>
          <HomepageDestinationPicker
            href={link}
            isAr={isAr}
            categories={categories}
            onChange={(path) => onFieldChange({ link: normalizeLink(path) })}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-text">{isAr ? 'رسائل متناوبة' : 'Rotating messages'}</p>
            <button
              type="button"
              onClick={() => onItemsChange([...rotateItems, emptyRotateItem()])}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? 'رسالة' : 'Message'}
            </button>
          </div>
          {rotateItems.length === 0 && (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-text-muted">
              {isAr ? 'أضف رسالتين على الأقل للتناوب.' : 'Add at least two messages to rotate.'}
            </p>
          )}
          {rotateItems.map((item, index) => (
            <div key={item._id || `ann-${index}`} className="rounded-xl border border-border bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-text-muted">#{index + 1}</span>
                <button type="button" onClick={() => onItemsChange(rotateItems.filter((_, i) => i !== index))} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder={isAr ? 'عربي' : 'Arabic'}
                  value={item.titleAr || ''}
                  onChange={(e) => {
                    const next = [...rotateItems];
                    next[index] = { ...item, titleAr: e.target.value };
                    onItemsChange(next);
                  }}
                />
                <input
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder="English"
                  value={item.titleEn || ''}
                  onChange={(e) => {
                    const next = [...rotateItems];
                    next[index] = { ...item, titleEn: e.target.value };
                    onItemsChange(next);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-border px-2 py-1.5 text-sm"
                  value={item.emoji || ''}
                  onChange={(e) => {
                    const next = [...rotateItems];
                    next[index] = { ...item, emoji: e.target.value };
                    onItemsChange(next);
                  }}
                >
                  <option value="">{isAr ? 'بدون أيقونة' : 'No icon'}</option>
                  {ANNOUNCEMENT_ICONS.map((emoji) => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
                <input
                  className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder={isAr ? 'رابط (اختياري)' : 'Link (optional)'}
                  value={item.link || ''}
                  onChange={(e) => {
                    const next = [...rotateItems];
                    next[index] = { ...item, link: normalizeLink(e.target.value) };
                    onItemsChange(next);
                  }}
                />
              </div>
            </div>
          ))}
          {!link && (
            <p className="text-[11px] text-text-muted">
              {isAr ? 'يمكن لكل رسالة رابطها الخاص — أو اتركها فارغة.' : 'Each message can have its own link — or leave empty.'}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-white p-4 space-y-4">
        <p className="text-sm font-bold text-text">{isAr ? 'متى يظهر؟' : 'When should it show?'}</p>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
          <span className="text-sm font-semibold text-emerald-950">{isAr ? 'مفعّل على الموقع' : 'Active on site'}</span>
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={config.isEnabled !== false}
            onChange={(e) => patchConfig({ isEnabled: e.target.checked })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">{isAr ? 'تاريخ البداية' : 'Start date'}</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={dateInputValue(config.startDate) || config.startDate || ''}
              onChange={(e) => patchConfig({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">{isAr ? 'تاريخ النهاية' : 'End date'}</label>
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => patchConfig({ runsForever: true, endDate: '' })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${runsForever ? 'bg-sky-600 text-white' : 'border border-border'}`}>
                {isAr ? '∞ بدون نهاية' : '∞ No end'}
              </button>
              <button type="button" onClick={() => patchConfig({ runsForever: false })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!runsForever ? 'bg-sky-600 text-white' : 'border border-border'}`}>
                {isAr ? 'حتى تاريخ' : 'Until date'}
              </button>
            </div>
            {!runsForever && (
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={dateInputValue(config.endDate) || config.endDate || ''}
                onChange={(e) => patchConfig({ runsForever: false, endDate: e.target.value })}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <p className="mb-3 text-sm font-bold text-text">{isAr ? 'سلوك الشريط' : 'Bar behavior'}</p>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={config.dismissible} onChange={(e) => patchConfig({ dismissible: e.target.checked })} />
            {isAr ? 'يمكن للزائر إغلاقه (×)' : 'Visitor can dismiss (×)'}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={config.sticky} onChange={(e) => patchConfig({ sticky: e.target.checked })} />
            {isAr ? 'ثابت أعلى الصفحة عند التمرير' : 'Sticky at top while scrolling'}
          </label>
        </div>
      </div>
    </div>
  );
}
