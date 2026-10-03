import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { DEFAULT_STOCK_THRESHOLD } from '../../utils/stockThreshold';

export default function ProductAdvancedFiltersPopover({
  isAr,
  priceMin,
  priceMax,
  marginBelow,
  isOurProduct = '',
  stockMax = '',
  onApply,
}) {
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState(priceMin ?? '');
  const [localMax, setLocalMax] = useState(priceMax ?? '');
  const [localMargin, setLocalMargin] = useState(marginBelow ?? '');
  const [localOurProduct, setLocalOurProduct] = useState(isOurProduct ?? '');
  const [localStockMax, setLocalStockMax] = useState(String(stockMax || DEFAULT_STOCK_THRESHOLD));

  const activeCount = [priceMin, priceMax, marginBelow, isOurProduct].filter((v) => v !== '' && v != null).length;

  const openPopover = () => {
    setLocalMin(priceMin ?? '');
    setLocalMax(priceMax ?? '');
    setLocalMargin(marginBelow ?? '');
    setLocalOurProduct(isOurProduct ?? '');
    setLocalStockMax(String(stockMax || DEFAULT_STOCK_THRESHOLD));
    setOpen(true);
  };

  const apply = () => {
    onApply({
      priceMin: localMin,
      priceMax: localMax,
      marginBelow: localMargin,
      isOurProduct: localOurProduct,
      stockMax: String(Number(localStockMax) >= 0 ? localStockMax : DEFAULT_STOCK_THRESHOLD),
    });
    setOpen(false);
  };

  const clear = () => {
    setLocalMin('');
    setLocalMax('');
    setLocalMargin('');
    setLocalOurProduct('');
    setLocalStockMax(String(DEFAULT_STOCK_THRESHOLD));
    onApply({
      priceMin: '',
      priceMax: '',
      marginBelow: '',
      isOurProduct: '',
      stockMax: String(DEFAULT_STOCK_THRESHOLD),
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={[
          'inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm transition-colors',
          activeCount > 0 ? 'border-orange-300 text-orange-950' : 'border-border text-text hover:border-orange-200',
        ].join(' ')}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {isAr ? 'فلاتر متقدمة' : 'Advanced filters'}
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="close" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-40 mt-2 w-72 space-y-3 rounded-2xl border border-border bg-white p-3 shadow-xl">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'نطاق السعر' : 'Price range'}
              </p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} placeholder={isAr ? 'من' : 'Min'} value={localMin} onChange={(e) => setLocalMin(e.target.value)} className="py-1.5 text-sm" />
                <span className="text-text-muted">—</span>
                <Input type="number" min={0} placeholder={isAr ? 'إلى' : 'Max'} value={localMax} onChange={(e) => setLocalMax(e.target.value)} className="py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'هامش ربح أقل من (%)' : 'Margin below (%)'}
              </p>
              <Input type="number" min={0} max={100} placeholder={isAr ? 'مثال: 10' : 'e.g. 10'} value={localMargin} onChange={(e) => setLocalMargin(e.target.value)} className="py-1.5 text-sm" />
              <p className="mt-1 text-[10px] leading-snug text-text-muted">
                {isAr ? 'يظهر المنتجات ذات هامش الربح المنخفض' : 'Surfaces products with thin profit margins'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'منتجنا' : 'Our product'}
              </p>
              <select
                value={localOurProduct}
                onChange={(e) => setLocalOurProduct(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm text-text shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="">{isAr ? 'الكل' : 'All'}</option>
                <option value="true">{isAr ? 'منتجاتنا فقط' : 'Our products only'}</option>
                <option value="false">{isAr ? 'غير منتجاتنا' : 'Not our products'}</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'حد تنبيه المخزون المنخفض' : 'Low-stock alert threshold'}
              </p>
              <Input
                type="number"
                min={0}
                step={1}
                value={localStockMax}
                onChange={(e) => setLocalStockMax(e.target.value)}
                className="w-24 py-1.5 text-sm"
              />
            </div>
            <div className="flex justify-between gap-2 border-t border-border pt-2">
              <button type="button" onClick={clear} className="text-xs font-semibold text-text-muted hover:text-text">
                {isAr ? 'مسح' : 'Clear'}
              </button>
              <Button size="sm" onClick={apply}>{isAr ? 'تطبيق' : 'Apply'}</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
