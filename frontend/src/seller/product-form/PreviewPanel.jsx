import { CheckCircle2, Circle, Store } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

export default function PreviewPanel({ form, isAr, sellerName, checks, onJump }) {
  const price = Number(form.price) || 0;
  const oldPrice = Number(form.oldPrice) || 0;
  const hasDiscount = oldPrice > price && price > 0;
  const pct = hasDiscount ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const main = form.media.find((m) => m.type !== 'video');
  const name = (isAr ? form.nameAr || form.nameEn : form.nameEn || form.nameAr) || (isAr ? 'اسم المنتج' : 'Product name');
  const done = checks.filter((c) => c.done).length;
  const score = Math.round((done / checks.length) * 100);
  const tone = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">{isAr ? 'كما يراه العميل' : 'Customer preview'}</p>
        <div className="p-4">
          <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
            {main ? <img src={main.url} alt="" className="h-full w-full object-cover" /> : <span className="text-5xl" aria-hidden>🛍️</span>}
            {hasDiscount && <span className="absolute start-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">-{pct}%</span>}
          </div>
          <p className="line-clamp-2 text-sm font-semibold">{name}</p>
          {form.size && <p className="text-xs text-slate-500">{form.size}</p>}
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-lg font-bold">{formatPrice(price)}</span>
            {hasDiscount && <span className="text-xs text-slate-400 line-through">{formatPrice(oldPrice)}</span>}
          </div>
          {sellerName && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Store className="h-3.5 w-3.5" />{isAr ? `يبيعه ${sellerName}` : `Sold by ${sellerName}`}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{isAr ? 'جودة المنتج' : 'Listing quality'}</p>
          <span className="text-sm font-extrabold">{score}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${score}%` }} />
        </div>
        <ul className="mt-3 space-y-1">
          {checks.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onJump(c.section)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-start text-xs hover:bg-slate-50">
                {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                <span className={c.done ? 'text-slate-500' : 'font-medium text-slate-800'}>{isAr ? c.ar : c.en}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
