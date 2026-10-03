import { useState } from 'react';
import { Check, Tag, X } from 'lucide-react';
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
      <div className={`space-y-1.5 ${compact ? 'text-sm' : ''}`}>
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-emerald-900">{discountCode}</p>
            <p className="truncate text-xs text-emerald-700/90">
              {language === 'ar' ? appliedCoupon.labelAr : appliedCoupon.labelEn}
            </p>
          </div>
          <button
            type="button"
            onClick={removeDiscountCode}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-700/70 transition-colors hover:bg-emerald-100 hover:text-red-600"
            aria-label={language === 'ar' ? 'إزالة' : 'Remove'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {discountAmount > 0 && (
          <p className="px-1 text-xs font-semibold text-emerald-700">
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
        <div className="relative min-w-0 flex-1">
          <Tag className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder={language === 'ar' ? 'كود الخصم' : 'Discount code'}
            className={`w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 uppercase ps-9 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 ${compact ? 'py-2 text-sm' : 'py-2.5 text-sm'}`}
          />
        </div>
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
      {discountError && <p className="mt-1.5 px-1 text-xs font-medium text-red-600">{discountError}</p>}
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
