import { formatPrice } from '../../utils/formatters';

function TotalRow({ label, value, muted = false, accent = false, large = false }) {
  return (
    <div className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 ${large ? 'pt-1' : ''}`}>
      <span className={`${large ? 'text-base font-bold text-text' : 'text-sm'} ${muted ? 'text-text-muted' : accent ? 'text-primary-600' : 'text-text-muted'}`}>
        {label}
      </span>
      <span className={`text-right tabular-nums ${large ? 'text-2xl font-bold text-primary-700' : `text-sm font-semibold ${accent ? 'text-primary-600' : 'text-text'}`}`}>
        {value}
      </span>
    </div>
  );
}

export default function CheckoutTotalsBlock({
  language = 'ar',
  totalLabel,
  subtotal,
  deliveryFee,
  discountAmount,
  total,
  coupon,
  discountCode,
  extraRows = [],
}) {
  const isAr = language === 'ar';

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/90 p-4 ring-1 ring-slate-200/60">
      <div className="space-y-2.5">
        <TotalRow
          label={isAr ? 'المجموع الفرعي' : 'Subtotal'}
          value={formatPrice(subtotal)}
          muted
        />
        <TotalRow
          label={isAr ? 'رسوم التوصيل' : 'Delivery fee'}
          value={deliveryFee === 0
            ? (isAr ? 'مجاني' : 'Free')
            : formatPrice(deliveryFee)}
          muted
        />
        {coupon && (
          <TotalRow
            label={`${isAr ? 'الخصم' : 'Discount'} (${discountCode})`}
            value={discountAmount > 0
              ? `− ${formatPrice(discountAmount)}`
              : (isAr ? 'مُطبّق' : 'Applied')}
            accent
          />
        )}
        {!coupon && discountAmount > 0 && (
          <TotalRow
            label={isAr ? 'الخصم' : 'Discount'}
            value={`− ${formatPrice(discountAmount)}`}
            accent
          />
        )}
        {coupon?.type === 'free_delivery' && deliveryFee === 0 && (
          <TotalRow
            label={isAr ? 'توصيل مجاني من الكوبون' : 'Free delivery (coupon)'}
            value="✓"
            accent
          />
        )}
        {extraRows.map((row) => (
          <TotalRow
            key={row.label}
            label={row.label}
            value={row.value}
            accent={row.className?.includes('primary')}
          />
        ))}
      </div>

      <div className="my-3 border-t border-slate-200/80" />

      <TotalRow
        label={totalLabel || (isAr ? 'الإجمالي' : 'Total')}
        value={formatPrice(total)}
        large
      />
    </div>
  );
}
