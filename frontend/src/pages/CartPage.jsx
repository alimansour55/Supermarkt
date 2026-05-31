import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import CartItemRow from '../components/cart/CartItemRow';
import CartSummary from '../components/cart/CartSummary';
import Button from '../components/ui/Button';

export default function CartPage() {
  const { t, language } = useLanguage();
  const { items, totalItems, updateQuantity, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="container-app flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
        <span className="text-6xl">🛒</span>
        <p className="mt-4 text-xl text-text-muted">{t.cart.empty}</p>
        <Link to="/products" className="mt-6">
          <Button>{language === 'ar' ? 'تسوق الآن' : 'Shop Now'}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">
          {t.nav.cart} ({totalItems} {t.cart.items})
        </h1>
        <button
          type="button"
          onClick={clearCart}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          {language === 'ar' ? 'إفراغ السلة' : 'Clear Cart'}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <CartItemRow
              key={item.productId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="h-fit lg:sticky lg:top-36">
          <CartSummary showDeliverySelector showDiscount />
        </div>
      </div>
    </div>
  );
}
