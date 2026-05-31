import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import CartItemRow from './CartItemRow';
import CartSummary from './CartSummary';
import FreeDeliveryProgress from './FreeDeliveryProgress';
import Button from '../ui/Button';

export default function CartDrawer() {
  const { t, language } = useLanguage();
  const {
    isDrawerOpen,
    closeDrawer,
    items,
    totalItems,
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
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className={`fixed inset-y-0 start-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out touch-pan-y ltr:-translate-x-full rtl:translate-x-full ${isDrawerOpen ? '!translate-x-0' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.nav.cart}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary-600" aria-hidden />
            <h2 className="text-lg font-bold">
              {t.nav.cart}
              {totalItems > 0 && (
                <span className="ms-2 text-sm font-normal text-text-muted">({totalItems})</span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface"
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-5 py-1 text-[10px] text-text-muted md:hidden">
          {language === 'ar' ? 'اسحب للإغلاق' : 'Swipe to close'}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
            <ShoppingCart className="h-16 w-16 text-slate-300" strokeWidth={1.25} />
            <p className="mt-4 text-lg font-medium text-text-muted">{t.cart.empty}</p>
            <p className="mt-1 text-sm text-text-muted">
              {language === 'ar' ? 'ابدأ بإضافة منتجات لسلتك' : 'Start adding products to your cart'}
            </p>
            <Link to="/products" onClick={closeDrawer} className="mt-6">
              <Button>{language === 'ar' ? 'تسوق الآن' : 'Shop Now'}</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 overscroll-contain">
              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  compact
                />
              ))}
            </div>

            <div className="border-t border-border bg-surface px-5 py-4 safe-bottom">
              <div className="mb-3">
                <FreeDeliveryProgress linkToCart={false} />
              </div>
              <CartSummary compact showCheckoutButton={false} />
              <Link to="/checkout" onClick={closeDrawer} className="mt-4 block">
                <Button className="w-full" size="lg">{t.cart.checkout}</Button>
              </Link>
              <div className="mt-3 flex gap-2">
                <Link to="/cart" onClick={closeDrawer} className="flex-1">
                  <Button variant="secondary" className="w-full" size="sm">
                    {language === 'ar' ? 'عرض السلة' : 'View Cart'}
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 min-h-[44px]"
                >
                  {language === 'ar' ? 'إفراغ السلة' : 'Clear'}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
