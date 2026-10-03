import { ChevronDown, ChevronUp, Mail, MessageCircle, Phone, PhoneOutgoing, Sparkles } from 'lucide-react';
import Input from '../../components/ui/Input';
import ToggleSwitch from './ToggleSwitch';

const TYPE_META = {
  phone: {
    Icon: Phone,
    iconBg: 'bg-sky-100 text-sky-700',
    hintAr: 'يفتح تطبيق الاتصال على جهاز العميل بالرقم أدناه',
    hintEn: "Opens the customer's dialer with the number below",
    valueLabelAr: 'رقم الهاتف',
    valueLabelEn: 'Phone number',
    valuePlaceholder: '16XXX',
  },
  callback: {
    Icon: PhoneOutgoing,
    iconBg: 'bg-amber-100 text-amber-700',
    hintAr: 'العميل يترك رقمه ويطلب أن يتصل به فريق الدعم',
    hintEn: 'Customer leaves their number and asks support to call them back',
  },
  chat: {
    Icon: MessageCircle,
    iconBg: 'bg-violet-100 text-violet-700',
    hintAr: 'يفتح نافذة المساعد الذكي للدردشة',
    hintEn: 'Opens the AI assistant chat window',
  },
  email: {
    Icon: Mail,
    iconBg: 'bg-emerald-100 text-emerald-700',
    hintAr: 'يفتح تطبيق البريد بعنوان الدعم أدناه',
    hintEn: "Opens the customer's email app addressed to the support email below",
    valueLabelAr: 'البريد الإلكتروني',
    valueLabelEn: 'Support email',
    valuePlaceholder: 'support@example.com',
  },
  whatsapp: {
    Icon: MessageCircle,
    iconBg: 'bg-green-100 text-green-700',
    hintAr: 'رابط واتساب أو أي رابط دردشة خارجي',
    hintEn: 'A WhatsApp link or other external chat link',
    valueLabelAr: 'الرابط',
    valueLabelEn: 'Link URL',
    valuePlaceholder: 'https://wa.me/...',
  },
  custom: {
    Icon: Sparkles,
    iconBg: 'bg-slate-100 text-slate-700',
    hintAr: 'قناة مخصّصة — أدخل رابطاً (mailto:, tel:, https://...)',
    hintEn: 'Custom channel — enter a link (mailto:, tel:, https://...)',
    valueLabelAr: 'الرابط أو القيمة',
    valueLabelEn: 'Link or value',
    valuePlaceholder: 'https://...',
  },
};

export default function CustomerServiceChannelEditorCard({
  channel,
  index,
  total,
  isAr,
  expanded,
  onToggleExpand,
  onUpdate,
  onMoveUp,
  onMoveDown,
}) {
  const enabled = channel.enabled !== false;
  const meta = TYPE_META[channel.type] || TYPE_META.custom;
  const { Icon } = meta;
  const needsValue = Boolean(meta.valueLabelAr);
  const title = isAr ? (channel.labelAr || channel.labelEn) : (channel.labelEn || channel.labelAr);

  return (
    <article
      className={[
        'overflow-hidden rounded-2xl border transition-shadow',
        enabled ? 'border-primary-200 shadow-sm' : 'border-slate-200 opacity-80',
      ].join(' ')}
    >
      <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3.5 sm:px-5 ${enabled ? 'bg-primary-50/40' : 'bg-slate-50/80'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-text">{title || (isAr ? 'قناة بدون اسم' : 'Unnamed channel')}</h3>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600',
              ].join(' ')}
            >
              {enabled ? (isAr ? 'مفعّلة' : 'Active') : (isAr ? 'معطّلة' : 'Inactive')}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{isAr ? meta.hintAr : meta.hintEn}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center rounded-xl border border-border bg-white p-0.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
            >
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={onMoveDown}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ToggleSwitch
            checked={enabled}
            onChange={(value) => onUpdate('enabled', value)}
            ariaLabel={isAr ? `تفعيل ${title}` : `Enable ${title}`}
          />
        </div>
      </div>

      <div className="space-y-4 bg-white p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-slate-50/60 px-4 py-3 text-start text-sm font-semibold text-text transition hover:bg-slate-50"
        >
          <span>{isAr ? 'تعديل الاسم والوصف والقيمة' : 'Edit label, description & value'}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {expanded && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'الاسم (عربي)' : 'Label (Arabic)'}
              value={channel.labelAr || ''}
              onChange={(e) => onUpdate('labelAr', e.target.value)}
            />
            <Input
              label={isAr ? 'الاسم (English)' : 'Label (English)'}
              value={channel.labelEn || ''}
              onChange={(e) => onUpdate('labelEn', e.target.value)}
            />
            <Input
              label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}
              value={channel.descriptionAr || ''}
              onChange={(e) => onUpdate('descriptionAr', e.target.value)}
            />
            <Input
              label={isAr ? 'الوصف (English)' : 'Description (English)'}
              value={channel.descriptionEn || ''}
              onChange={(e) => onUpdate('descriptionEn', e.target.value)}
            />
            {needsValue && (
              <Input
                className="md:col-span-2"
                label={isAr ? meta.valueLabelAr : meta.valueLabelEn}
                value={channel.value || ''}
                onChange={(e) => onUpdate('value', e.target.value)}
                placeholder={meta.valuePlaceholder}
              />
            )}
          </div>
        )}

        {!expanded && (
          <div className="rounded-xl border border-dashed border-border bg-slate-50/50 px-4 py-3 text-sm">
            {(channel.descriptionAr || channel.descriptionEn) && (
              <p className="text-text-muted">{isAr ? channel.descriptionAr : channel.descriptionEn}</p>
            )}
            {needsValue && channel.value && (
              <p className="mt-1 font-semibold text-text" dir="ltr">{channel.value}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
