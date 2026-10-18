import { useState } from 'react';
import { Check, Copy, Ticket } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { ShopIconBadge } from '../ui/ShopIcon';

function offerText(coupon, isAr) {
  if (coupon.discountType === 'free_delivery') return isAr ? 'توصيل مجاني' : 'Free delivery';
  if (coupon.discountType === 'percent') return isAr ? `خصم ${coupon.discountValue}%` : `${coupon.discountValue}% off`;
  return isAr ? `خصم ${coupon.discountValue} جنيه` : `EGP ${coupon.discountValue} off`;
}

function expiryText(date, isAr) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' });
  return isAr ? `حتى ${day}` : `Until ${day}`;
}

/**
 * A coupon the shopper can copy. The server only sends a store-wide code that
 * would be accepted today — no coupon means the section is hidden.
 */
export default function HomepageCouponCard({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [copied, setCopied] = useState(false);
  const coupon = section.coupon;
  if (!coupon?.code) return null;

  const bold = section.blockConfig?.couponStyle === 'bold';
  const title = (isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr)
    || (isAr ? coupon.labelAr : coupon.labelEn)
    || offerText(coupon, isAr);
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const terms = [
    coupon.minSubtotal > 0 ? (isAr ? `للطلبات فوق ${coupon.minSubtotal} جنيه` : `On orders over EGP ${coupon.minSubtotal}`) : '',
    expiryText(coupon.expiryDate, isAr),
  ].filter(Boolean).join(' · ');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="container-app py-4">
      <div
        className={`relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
          bold
            ? 'bg-gradient-to-r from-primary-700 to-primary-500 text-white shadow-md'
            : 'border-2 border-dashed border-primary-300 bg-primary-50/60 text-text'
        }`}
      >
        <div className="flex min-w-0 items-start gap-4">
          <ShopIconBadge name={section.icon} fallback="ticket" tone={bold ? 'onColor' : 'solid'} size="lg" />
          <div className="min-w-0">
            <p className={`text-xs font-bold ${bold ? 'text-white/80' : 'text-primary-700'}`}>{offerText(coupon, isAr)}</p>
            <h2 className="mt-0.5 text-lg font-bold md:text-xl">{title}</h2>
            {subtitle && <p className={`mt-1 text-sm ${bold ? 'text-white/90' : 'text-text-muted'}`}>{subtitle}</p>}
            {terms && <p className={`mt-1 text-xs ${bold ? 'text-white/75' : 'text-text-muted'}`}>{terms}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-dashed px-4 font-mono text-base font-extrabold tracking-wider transition ${
              bold ? 'border-white/70 bg-white/10 hover:bg-white/20' : 'border-primary-400 bg-white text-primary-800 hover:bg-primary-50'
            }`}
            aria-label={isAr ? `انسخ الكود ${coupon.code}` : `Copy code ${coupon.code}`}
          >
            <Ticket className="h-4 w-4" aria-hidden />
            {coupon.code}
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4 opacity-70" aria-hidden />}
          </button>
          {section.link && (
            <Link
              to={section.link}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold ${
                bold ? 'bg-white text-primary-700 hover:bg-white/90' : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {(isAr ? section.ctaLabelAr : section.ctaLabelEn) || (isAr ? 'تسوّق الآن' : 'Shop now')}
            </Link>
          )}
        </div>
        <span className="sr-only" aria-live="polite">{copied ? (isAr ? 'تم نسخ الكود' : 'Code copied') : ''}</span>
      </div>
    </section>
  );
}
