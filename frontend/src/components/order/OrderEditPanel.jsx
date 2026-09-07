import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { orderService, productService } from '../../services/apiServices';
import { formatPrice } from '../../utils/formatters';
import { mapOrderItemsToEditPayload, orderItemKey } from '../../utils/orderEditHelpers';
import { getProductAvailableStock } from '../../utils/productHelpers';
import Button from '../ui/Button';
import ProductImage from '../ui/ProductImage';

function EditLineRow({
  item,
  isAr,
  onQuantityChange,
  onRemove,
  disableRemove,
}) {
  const title = isAr ? item.nameAr : (item.nameEn || item.nameAr);

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-white p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        <ProductImage
          src={item.image}
          alt=""
          className="h-full w-full"
          imgClassName="h-full w-full object-contain p-1"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="text-xs text-text-muted">{formatPrice(item.price)}</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, item.quantity - 1))}
            disabled={item.quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
            aria-label={isAr ? 'تقليل' : 'Decrease'}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(item.quantity + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border"
            aria-label={isAr ? 'زيادة' : 'Increase'}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disableRemove}
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
            aria-label={isAr ? 'حذف' : 'Remove'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="shrink-0 text-sm font-bold text-primary-700 tabular-nums">
        {formatPrice(item.price * item.quantity)}
      </p>
    </div>
  );
}

export default function OrderEditPanel({
  order,
  isAr,
  onClose,
  onSaved,
}) {
  const [items, setItems] = useState(() => mapOrderItemsToEditPayload(order.items || []));
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await productService.getAll({ q: search.trim(), limit: 8, inStock: true });
        if (!cancelled) setSearchResults(data.data || data.products || []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const quotePayload = useMemo(() => items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    price: item.price,
    quantity: item.quantity,
  })), [items]);

  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      return undefined;
    }

    let cancelled = false;
    setQuoteLoading(true);
    orderService.calculate({
      items: quotePayload,
      deliveryMethod: order.deliveryMethod || 'scheduled',
      discountCode: order.couponCode || order.discountCode || undefined,
      pointsToRedeem: order.pointsRedeemed || 0,
      deliveryZoneId: order.deliveryZone?._id || order.deliveryZone,
    }).then(({ data }) => {
      if (!cancelled) setQuote(data);
    }).catch(() => {
      if (!cancelled) setQuote(null);
    }).finally(() => {
      if (!cancelled) setQuoteLoading(false);
    });

    return () => { cancelled = true; };
  }, [quotePayload, order]);

  const updateQuantity = (key, quantity) => {
    setItems((prev) => prev.map((item) => (
      orderItemKey(item) === key ? { ...item, quantity } : item
    )));
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((item) => orderItemKey(item) !== key));
  };

  const addProduct = (product) => {
    const stock = getProductAvailableStock(product);
    if (stock < 1) {
      setError(isAr ? 'المنتج غير متوفر في المخزون' : 'Product is out of stock');
      return;
    }
    const key = orderItemKey({ productId: product._id, variantId: null });
    setError('');
    setItems((prev) => {
      const existing = prev.find((item) => orderItemKey(item) === key);
      if (existing) {
        const nextQty = Math.min(stock, existing.quantity + 1);
        return prev.map((item) => (
          orderItemKey(item) === key ? { ...item, quantity: nextQty } : item
        ));
      }
      return [...prev, {
        productId: product._id,
        variantId: null,
        quantity: 1,
        nameAr: product.nameAr || product.name,
        nameEn: product.nameEn,
        price: product.price,
        image: product.image || product.emoji,
        unit: product.unit,
      }];
    });
    setSearch('');
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!items.length) {
      setError(isAr ? 'يجب أن يحتوي الطلب على منتج واحد على الأقل' : 'Order must contain at least one item');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await orderService.updateItems(order._id, {
        lang: isAr ? 'ar' : 'en',
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });
      onSaved?.(data.order);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذّر حفظ التعديلات' : 'Could not save changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/40 p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{isAr ? 'تعديل الطلب' : 'Edit order'}</h2>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'يمكنك إضافة أو حذف المنتجات وتغيير الكميات قبل أن يخرج الطلب للتوصيل.'
              : 'Add, remove, or change quantities until the order goes out for delivery.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white hover:bg-slate-50"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <EditLineRow
            key={orderItemKey(item)}
            item={item}
            isAr={isAr}
            disableRemove={items.length <= 1}
            onQuantityChange={(quantity) => updateQuantity(orderItemKey(item), quantity)}
            onRemove={() => removeItem(orderItemKey(item))}
          />
        ))}
      </div>

      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-semibold">
          {isAr ? 'إضافة منتج' : 'Add product'}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث باسم المنتج...' : 'Search products...'}
            className="w-full rounded-xl border border-border bg-white py-2.5 ps-10 pe-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        {searchLoading && (
          <p className="mt-2 text-xs text-text-muted">{isAr ? 'جاري البحث...' : 'Searching...'}</p>
        )}
        {searchResults.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-white shadow-sm">
            {searchResults.map((product) => (
              <li key={product._id}>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-primary-50"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                    <ProductImage src={product.image || product.emoji} alt="" className="h-full w-full" imgClassName="h-full w-full object-contain p-0.5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {isAr ? product.nameAr || product.name : product.nameEn || product.nameAr || product.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-primary-700">{formatPrice(product.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
          <span className="font-semibold tabular-nums">
            {quoteLoading ? '…' : formatPrice(quote?.subtotal ?? order.subtotal)}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-4">
          <span className="text-text-muted">{isAr ? 'الإجمالي الجديد' : 'New total'}</span>
          <span className="text-base font-bold text-primary-700 tabular-nums">
            {quoteLoading ? '…' : formatPrice(quote?.total ?? order.total)}
          </span>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving || quoteLoading} className="flex-1">
          {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save changes')}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
