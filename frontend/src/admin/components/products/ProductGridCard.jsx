import { useState } from 'react';
import { pickProductImage } from '../../../utils/imageHelpers';
import { formatPrice } from '../../../utils/formatters';
import RowActionsMenu from '../list/RowActionsMenu';

function GridThumbnail({ product }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? pickProductImage(product) : null;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-2xl" aria-hidden>
      {product.emoji || '📦'}
    </div>
  );
}

export default function ProductGridCard({ product, isAr, selected, onToggleSelect, actions, stockThreshold }) {
  const sellableButEmpty = product.isActive && product.stock <= 0;
  const statusClassName = sellableButEmpty
    ? 'bg-amber-100 text-amber-800 ring-amber-200'
    : product.isActive
      ? 'bg-green-100 text-green-800 ring-green-200'
      : 'bg-slate-100 text-slate-600 ring-slate-200';
  const statusLabel = sellableButEmpty
    ? (isAr ? 'نشط · نفذ' : 'Active · out')
    : product.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive');

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md',
        selected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-border',
      ].join(' ')}
    >
      <div className="absolute start-1.5 top-1.5 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(product._id)}
          className="h-3.5 w-3.5 rounded border-white bg-white/90 shadow"
          aria-label={isAr ? 'تحديد المنتج' : 'Select product'}
        />
      </div>
      <div className="absolute end-1.5 top-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <RowActionsMenu items={actions} isAr={isAr} />
      </div>
      <div className="aspect-square w-full border-b border-border">
        <GridThumbnail product={product} />
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium text-text">{isAr ? product.nameAr || product.nameEn : product.nameEn}</p>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold tabular-nums text-text">{formatPrice(product.price)}</span>
          <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>
        <p className={`text-[11px] tabular-nums ${product.stock <= 0 ? 'font-semibold text-red-600' : product.stock <= stockThreshold ? 'font-semibold text-amber-700' : 'text-text-muted'}`}>
          {isAr ? `المخزون: ${product.stock}` : `Stock: ${product.stock}`}
        </p>
      </div>
    </div>
  );
}
