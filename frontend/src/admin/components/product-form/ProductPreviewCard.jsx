import { formatPrice } from '../../../utils/formatters';

export default function ProductPreviewCard({ watch, images, isAr }) {
  const nameAr = watch('nameAr');
  const nameEn = watch('nameEn');
  const price = Number(watch('price')) || 0;
  const oldPrice = Number(watch('oldPrice')) || 0;
  const stock = Number(watch('stock')) || 0;
  const isActive = watch('isActive');
  const emoji = watch('emoji') || '🛍️';

  const hasDiscount = oldPrice > price && price > 0;
  const discountPct = hasDiscount ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const image = images?.[0]?.url;
  const name = (isAr ? nameAr : nameEn) || (isAr ? 'اسم المنتج' : 'Product name');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {isAr ? 'معاينة مباشرة' : 'Live preview'}
        </p>
      </div>
      <div className="p-4">
        <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-5xl" aria-hidden>{emoji}</span>
          )}
          {hasDiscount && (
            <span className="absolute start-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              -{discountPct}%
            </span>
          )}
          {!isActive && (
            <span className="absolute end-2 top-2 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-white">
              {isAr ? 'معطل' : 'Inactive'}
            </span>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-text">{name}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-lg font-bold text-text">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-text-muted line-through">{formatPrice(oldPrice)}</span>
          )}
        </div>
        <p className={`mt-1 text-xs ${stock <= 0 ? 'font-semibold text-red-600' : 'text-text-muted'}`}>
          {stock <= 0
            ? (isAr ? 'نفد المخزون' : 'Out of stock')
            : (isAr ? `المخزون: ${stock}` : `Stock: ${stock}`)}
        </p>
      </div>
    </div>
  );
}
