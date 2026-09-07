import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import CartItemRow from './CartItemRow';
import CartSummary from './CartSummary';
import FreeDeliveryProgress from './FreeDeliveryProgress';
import Button from '../ui/Button';

export default function CartDrawer() {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const {
    isDrawerOpen,
    closeDrawer,
    items,
    totalItems,
    cartPromoSummary,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();
  const panelRef = useRef(null);

  useSwipeToClose(panelRef, isDrawerOpen, closeDrawer);

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isDrawerOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDrawer]);

  return (
    <div className={`fixed inset-0 z-[100] ${isDrawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isDrawerOpen}>
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className={`fixed inset-y-0 start-0 flex w-full max-w-[400px] flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-out touch-pan-y ltr:-translate-x-full rtl:translate-x-full ${isDrawerOpen ? '!translate-x-0' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.nav.cart}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
              <ShoppingCart className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight text-slate-900">{t.nav.cart}</h2>
              {totalItems > 0 && (
                <p className="text-xs text-slate-500">
                  {isAr ? `${totalItems} منتج` : `${totalItems} item${totalItems === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <ShoppingBag className="h-9 w-9 text-slate-300" strokeWidth={1.5} />
            </span>
            <p className="mt-5 text-lg font-semibold text-slate-800">{t.cart.empty}</p>
            <p className="mt-1 max-w-[240px] text-sm leading-relaxed text-slate-500">
              {isAr ? 'ابدأ بإضافة منتجات لسلتك' : 'Start adding products to your cart'}
            </p>
            <Link to="/products" onClick={closeDrawer} className="mt-6">
              <Button size="lg">{isAr ? 'تسوق الآن' : 'Shop Now'}</Button>
            </Link>
          </div>
        ) : (
          <>
            {cartPromoSummary?.hasAnyOffer && (
              <div className="shrink-0 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
                  {cartPromoSummary.summaryLabel || (isAr ? 'عروض نشطة على منتجاتك' : 'Active offers on your items')}
                </p>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin">
              <div className="space-y-2.5">
                {items.map((item) => (
                  <CartItemRow
                    key={item.cartKey || item.productId}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                    compact
                  />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-4 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] safe-bottom">
              <div className="mb-3">
                <FreeDeliveryProgress linkToCart={false} dense />
              </div>
              <CartSummary compact showCheckoutButton={false} hidePromoBanner />
              <Button
                className="mt-4 w-full shadow-md shadow-primary-600/20"
                size="lg"
                onClick={() => {
                  closeDrawer();
                  navigate('/checkout');
                }}
              >
                {t.cart.checkout}
              </Button>
              <div className="mt-3 flex items-center gap-2">
                <Link to="/cart" onClick={closeDrawer} className="flex-1">
                  <Button variant="secondary" className="w-full" size="sm">
                    {isAr ? 'عرض السلة' : 'View Cart'}
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const ok = window.confirm(
                      isAr ? 'هل تريد إفراغ السلة بالكامل؟' : 'Empty the entire cart?',
                    );
                    if (ok) clearCart();
                  }}
                  className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  {isAr ? 'إفراغ' : 'Clear'}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
