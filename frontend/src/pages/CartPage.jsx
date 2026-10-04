import { Link } from '../app/router';
import { ArrowLeft, ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import CartItemRow from '../components/cart/CartItemRow';
import CartSummary from '../components/cart/CartSummary';
import FreeDeliveryProgress from '../components/cart/FreeDeliveryProgress';
import Button from '../components/ui/Button';
import { formatPrice } from '../utils/formatters';
import { useStoreSettings } from '../context/StoreSettingsContext';

/** Cart lines grouped by who ships them — one group per seller shipment, plus the store's own. */
function groupCartBySeller(items) {
  const groups = new Map();
  for (const item of items) {
    const seller = item.soldBy;
    const shipsItself = seller && item.fulfilledBy !== 'store';
    const key = seller ? `${seller._id}:${shipsItself ? 'seller' : 'store'}` : 'store';
    if (!groups.has(key)) groups.set(key, { key, seller: seller || null, shipsItself, items: [] });
    groups.get(key).items.push(item);
  }
  // Store-delivered first, then seller shipments.
  return [...groups.values()].sort((a, b) => Number(a.shipsItself) - Number(b.shipsItself));
}

export default function CartPage() {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { items, totalItems, total, updateQuantity, removeItem, clearCart } = useCart();
  const { settings } = useStoreSettings() || {};
  const storeName = (isAr ? settings?.storeNameAr : settings?.storeNameEn) || (isAr ? 'المتجر' : 'the store');
  const hasSellerItems = items.some((item) => item.soldBy);
  const groups = hasSellerItems ? groupCartBySeller(items) : [{ key: 'all', items }];
  const BackArrow = isAr ? ArrowLeft : ArrowRight;

  if (items.length === 0) {
    return (
      <div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 shadow-sm ring-1 ring-primary-100">
          <ShoppingCart className="h-11 w-11 text-primary-300" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="mt-6 text-xl font-bold text-slate-900">{t.cart.empty}</p>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          {isAr ? 'تصفح منتجاتنا وابدأ بإضافة ما يعجبك إلى سلتك' : 'Browse our products and start adding items to your cart'}
        </p>
        <Link to="/products" className="mt-6">
          <Button size="lg">{isAr ? 'تسوق الآن' : 'Shop Now'}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-6 pb-36 md:py-8 md:pb-24 lg:pb-8">
      <h1 className="sr-only">{t.nav.cart}</h1>

      <div className="mb-5">
        <FreeDeliveryProgress />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">{t.nav.cart}</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {totalItems} {t.cart.items}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/products"
                className="hidden items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline sm:inline-flex"
              >
                {isAr ? 'متابعة التسوق' : 'Continue shopping'}
                <BackArrow className="h-4 w-4" aria-hidden />
              </Link>
              <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    isAr ? 'هل تريد إفراغ السلة بالكامل؟' : 'Empty the entire cart?',
                  );
                  if (ok) clearCart();
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {isAr ? 'إفراغ السلة' : 'Clear Cart'}
              </button>
            </div>
          </div>

          {groups.map((group) => (
            <section key={group.key} className="border-b border-slate-100 last:border-b-0">
              {hasSellerItems && (
                <p className="bg-slate-50/80 px-4 py-2 text-xs font-semibold text-slate-600 sm:px-5">
                  {!group.seller
                    ? (isAr ? `يشحنه ${storeName}` : `Shipped by ${storeName}`)
                    : group.shipsItself
                      ? (isAr
                        ? `شحنة منفصلة — يبيعها ويشحنها ${group.seller.nameAr || group.seller.nameEn}`
                        : `Separate shipment — sold and shipped by ${group.seller.nameEn || group.seller.nameAr}`)
                      : (isAr
                        ? `يبيعه ${group.seller.nameAr || group.seller.nameEn} · يشحنه ${storeName}`
                        : `Sold by ${group.seller.nameEn || group.seller.nameAr} · shipped by ${storeName}`)}
                </p>
              )}
              <div className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <CartItemRow
                    key={item.cartKey || item.productId}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                    bare
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="lg:sticky lg:top-28">
          <CartSummary
            showDiscount
            hideFreeDeliveryBar
          />
        </div>
      </div>

      <div className="fixed inset-x-0 z-40 bottom-[calc(62px+env(safe-area-inset-bottom,0px))] md:bottom-[env(safe-area-inset-bottom,0px)] lg:hidden">
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <Link
            to="/checkout"
            className="flex items-center justify-between gap-3 rounded-full bg-primary-600 px-5 py-3.5 text-white shadow-card transition-colors hover:bg-primary-700"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium text-primary-100">{t.cart.total}</span>
              <span className="text-base font-extrabold tabular-nums">{formatPrice(total)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm font-bold">
              {isAr ? 'إتمام الشراء' : 'Checkout'}
              <BackArrow className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
