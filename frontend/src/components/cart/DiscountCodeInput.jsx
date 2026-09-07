import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import Button from '../ui/Button';
import FreeDeliveryProgress from './FreeDeliveryProgress';

export default function DiscountCodeInput({ compact = false, hideHint = false }) {
  const { language } = useLanguage();
  const { discountCode, discountError, applyDiscountCode, removeDiscountCode, appliedCoupon, discountAmount } = useCart();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    try {
      const ok = await applyDiscountCode(code.trim());
      if (ok) setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  if (discountCode && appliedCoupon) {
    return (
      <div className={`space-y-2 ${compact ? 'text-sm' : ''}`}>
        <div className={`flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2`}>
          <span className="font-medium text-primary-700">
            🏷️ {discountCode}
            {' — '}
            {language === 'ar' ? appliedCoupon.labelAr : appliedCoupon.labelEn}
          </span>
          <button
            type="button"
            onClick={removeDiscountCode}
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            {language === 'ar' ? 'إزالة' : 'Remove'}
          </button>
        </div>
        {discountAmount > 0 && (
          <p className="text-xs font-semibold text-emerald-700">
            {language === 'ar'
              ? `وفرت ${discountAmount.toFixed(2)} ج.م`
              : `You save ${discountAmount.toFixed(2)} EGP`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={language === 'ar' ? 'كود الخصم' : 'Discount code'}
          className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 uppercase focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 ${compact ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-sm'}`}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !code.trim()}
          onClick={handleApply}
          className="shrink-0 px-4"
        >
          {loading ? '…' : (language === 'ar' ? 'تطبيق' : 'Apply')}
        </Button>
      </div>
      {discountError && <p className="mt-1 text-xs text-red-600">{discountError}</p>}
      {!compact && !hideHint && (
        <p className="mt-2 text-xs text-text-muted">
          {language === 'ar' ? 'أدخل كود الخصم من لوحة التحكم' : 'Enter your discount code from checkout or promotions'}
        </p>
      )}
    </div>
  );
}

export function FreeDeliveryBar() {
  return <FreeDeliveryProgress />;
}
