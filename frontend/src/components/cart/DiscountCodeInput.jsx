import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import Button from '../ui/Button';
import FreeDeliveryProgress from './FreeDeliveryProgress';

export default function DiscountCodeInput({ compact = false }) {
  const { language } = useLanguage();
  const { discountCode, discountError, applyDiscountCode, removeDiscountCode, appliedCoupon } = useCart();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    await applyDiscountCode(code.trim());
    setLoading(false);
    setCode('');
  };

  if (discountCode && appliedCoupon) {
    return (
      <div className={`flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2 ${compact ? 'text-sm' : ''}`}>
        <span className="font-medium text-primary-700">
          🏷️ {discountCode} — {language === 'ar' ? appliedCoupon.labelAr : appliedCoupon.labelEn}
        </span>
        <button
          type="button"
          onClick={removeDiscountCode}
          className="text-xs font-semibold text-red-600 hover:text-red-700"
        >
          {language === 'ar' ? 'إزالة' : 'Remove'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleApply} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={language === 'ar' ? 'كود الخصم' : 'Discount code'}
          className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm uppercase focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={loading || !code.trim()}>
          {language === 'ar' ? 'تطبيق' : 'Apply'}
        </Button>
      </form>
      {discountError && <p className="mt-1 text-xs text-red-600">{discountError}</p>}
      {!compact && (
        <p className="mt-2 text-xs text-text-muted">
          {language === 'ar' ? 'جرب: FIRST20, SAVE50, FREESHIP' : 'Try: FIRST20, SAVE50, FREESHIP'}
        </p>
      )}
    </div>
  );
}

export function FreeDeliveryBar() {
  return <FreeDeliveryProgress />;
}
