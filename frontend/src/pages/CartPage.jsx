import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import CartItemRow from '../components/cart/CartItemRow';
import CartSummary from '../components/cart/CartSummary';
import Button from '../components/ui/Button';

export default function CartPage() {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { items, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const BackArrow = isAr ? ArrowLeft : ArrowRight;

  if (items.length === 0) {
    return (
      <div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
          <ShoppingCart className="h-11 w-11 text-slate-300" strokeWidth={1.5} aria-hidden />
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
    <div className="container-app py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm">
            <ShoppingCart className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{t.nav.cart}</h1>
            <p className="text-sm text-text-muted">
              {totalItems} {t.cart.items}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 sm:inline-flex"
          >
            {isAr ? 'متابعة التسوق' : 'Continue shopping'}
            <BackArrow className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                isAr ? 'هل تريد إفراغ السلة بالكامل؟' : 'Empty the entire cart?',
              );
              if (ok) clearCart();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {isAr ? 'إفراغ السلة' : 'Clear Cart'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <CartItemRow
              key={item.cartKey || item.productId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="h-fit lg:sticky lg:top-36">
          <CartSummary
            showDeliverySelector
            showDiscount
            showCheckoutButton={false}
            footer={(
              <Link to="/checkout" className="block">
                <Button className="w-full" size="lg">
                  {isAr ? 'الانتقال إلى إتمام الشراء' : 'Go to checkout'}
                </Button>
              </Link>
            )}
          />
        </div>
      </div>
    </div>
  );
}
