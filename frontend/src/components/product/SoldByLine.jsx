import { Store, Truck } from 'lucide-react';
import { Link } from '../../app/router';
import { useStoreSettings } from '../../context/StoreSettingsContext';

/**
 * Marketplace attribution — "Sold by X · Shipped by Y". Store-owned products (no `soldBy`)
 * render nothing in compact mode and "Sold & shipped by <store>" in full mode.
 */
export default function SoldByLine({ product, isAr, variant = 'full', className = '' }) {
  const { settings } = useStoreSettings() || {};
  const storeName = (isAr ? settings?.storeNameAr || settings?.storeName : settings?.storeNameEn || settings?.storeName)
    || (isAr ? 'المتجر' : 'the store');
  const seller = product?.soldBy;

  if (variant === 'compact') {
    if (!seller) return null;
    return (
      <p className={`mt-0.5 line-clamp-1 text-[11px] leading-tight text-slate-500 ${className}`}>
        {isAr ? 'يبيعه ' : 'Sold by '}
        <span className="font-semibold text-slate-700">{isAr ? seller.nameAr || seller.nameEn : seller.nameEn || seller.nameAr}</span>
      </p>
    );
  }

  const sellerName = seller ? (isAr ? seller.nameAr || seller.nameEn : seller.nameEn || seller.nameAr) : storeName;
  const shippedByStore = !seller || product.fulfilledBy === 'store';

  return (
    <div className={`mt-3 space-y-1 rounded-xl border border-border bg-slate-50/70 px-3 py-2 text-sm ${className}`}>
      <p className="flex items-center gap-2">
        <Store className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="text-text-muted">{isAr ? 'يبيعه' : 'Sold by'}</span>
        {seller?.slug ? (
          <Link to={`/sellers/${seller.slug}`} className="font-semibold text-primary-700 hover:underline">{sellerName}</Link>
        ) : (
          <span className="font-semibold">{sellerName}</span>
        )}
      </p>
      <p className="flex items-center gap-2">
        <Truck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="text-text-muted">{isAr ? 'يشحنه' : 'Shipped by'}</span>
        <span className="font-semibold">{shippedByStore ? storeName : sellerName}</span>
        {shippedByStore && seller && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            {isAr ? 'توصيل المتجر' : 'Store delivery'}
          </span>
        )}
      </p>
    </div>
  );
}
