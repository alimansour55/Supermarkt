import Input from '../../components/ui/Input';
import { FREE_DELIVERY_BANNER_PLACEHOLDERS } from '../../utils/freeDelivery';

const BANNER_ROWS = [
  {
    key: 'progress',
    labelAr: 'تحت الحد',
    labelEn: 'Below threshold',
    titleHintAr: 'مثال: أضف {{remaining}} للمجاني',
    titleHintEn: 'e.g. Add {{remaining}} for free',
    subtitleHintAr: 'مثال: {{methodsOnly}} · {{subtotal}}',
    subtitleHintEn: 'e.g. {{methodsOnly}} · {{subtotal}}',
  },
  {
    key: 'success',
    labelAr: 'مجاني على طريقتك',
    labelEn: 'Free on current method',
    titleHintAr: 'مثال: 🎉 توصيل مجاني',
    titleHintEn: 'e.g. 🎉 Free delivery',
    subtitleOptional: true,
  },
  {
    key: 'switch',
    labelAr: 'وصلت للحد — طريقة غير مشمولة',
    labelEn: 'Threshold met — wrong method',
    titleHintAr: 'مثال: 🎉 توصيل مجاني',
    titleHintEn: 'e.g. 🎉 Free delivery',
    subtitleHintAr: 'مثال: {{methodsOnly}}',
    subtitleHintEn: 'e.g. {{methodsOnly}}',
  },
  {
    key: 'coupon',
    labelAr: 'كوبون توصيل مجاني',
    labelEn: 'Coupon free delivery',
    titleHintAr: 'مثال: 🎁 توصيل مجاني',
    titleHintEn: 'e.g. 🎁 Free delivery',
    subtitleHintAr: 'مثال: من الكوبون',
    subtitleHintEn: 'e.g. Coupon applied',
  },
];

export default function FreeDeliveryBannerFields({ value = {}, onChange, isAr }) {
  const banner = value || {};

  const update = (field, next) => {
    onChange({ ...banner, [field]: next });
  };

  return (
    <div className="md:col-span-2 space-y-4">
      <div>
        <p className="text-sm font-semibold text-text">
          {isAr ? 'نصوص شريط التوصيل المجاني' : 'Free delivery banner messages'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {isAr
            ? 'تُطبَّق على كل المناطق. اكتب العربية والإنجليزية منفصلين.'
            : 'Applies store-wide. Write Arabic and English separately.'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {isAr ? 'المتغيرات: ' : 'Placeholders: '}
          {FREE_DELIVERY_BANNER_PLACEHOLDERS.join(' · ')}
        </p>
      </div>

      <div className="space-y-4">
        {BANNER_ROWS.map((row) => (
          <div key={row.key} className="rounded-xl border border-border bg-slate-50/80 p-4">
            <p className="mb-3 text-sm font-semibold text-text">
              {isAr ? row.labelAr : row.labelEn}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label={isAr ? 'السطر الأول (عربي)' : 'Line 1 (Arabic)'}
                value={banner[`${row.key}TitleAr`] || ''}
                onChange={(e) => update(`${row.key}TitleAr`, e.target.value)}
                placeholder={row.titleHintAr}
              />
              <Input
                label={isAr ? 'Line 1 (English)' : 'Line 1 (English)'}
                value={banner[`${row.key}TitleEn`] || ''}
                onChange={(e) => update(`${row.key}TitleEn`, e.target.value)}
                placeholder={row.titleHintEn}
              />
              <Input
                label={isAr ? 'السطر الثاني (عربي)' : 'Line 2 (Arabic)'}
                value={banner[`${row.key}SubtitleAr`] || ''}
                onChange={(e) => update(`${row.key}SubtitleAr`, e.target.value)}
                placeholder={row.subtitleHintAr || (isAr ? 'اختياري — اتركه فارغاً' : 'Optional — leave empty')}
              />
              <Input
                label={isAr ? 'Line 2 (English)' : 'Line 2 (English)'}
                value={banner[`${row.key}SubtitleEn`] || ''}
                onChange={(e) => update(`${row.key}SubtitleEn`, e.target.value)}
                placeholder={row.subtitleHintEn || 'Optional — leave empty'}
              />
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-slate-50/80 p-4">
          <p className="mb-3 text-sm font-semibold text-text">
            {isAr ? 'ملاحظة على خيار التوصيل' : 'Delivery option note'}
          </p>
          <p className="mb-3 text-xs text-text-muted">
            {isAr
              ? 'تظهر على الطرق غير المشمولة بالمجاني عند الوصول للحد.'
              : 'Shown on delivery options not included when threshold is met.'}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label={isAr ? 'عربي' : 'Arabic'}
              value={banner.methodNoteAr || ''}
              onChange={(e) => update('methodNoteAr', e.target.value)}
              placeholder="{{methodsOnly}}"
            />
            <Input
              label="English"
              value={banner.methodNoteEn || ''}
              onChange={(e) => update('methodNoteEn', e.target.value)}
              placeholder="{{methodsOnly}}"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
