import { Gift, Tag } from 'lucide-react';
import { getCartOfferLine } from '../../utils/cartPromotion';
import SecondItemPriceHighlight from '../promo/SecondItemPriceHighlight';

const TONE_CLASS = {
  violet: 'border-violet-200 bg-violet-50 text-violet-900',
  red: 'border-red-200 bg-red-50 text-red-900',
  orange: 'border-orange-200 bg-orange-50 text-orange-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
};

export default function CartPromoLine({ item, isAr, compact = false }) {
  const offer = getCartOfferLine(item, isAr);
  if (!offer?.text) return null;

  const Icon = offer.kind === 'discount' ? Tag : Gift;

  if (compact) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight ${
            TONE_CLASS[offer.tone] || TONE_CLASS.orange
          }`}
        >
          <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">{offer.text}</span>
          {offer.badge && (
            <span className="shrink-0 rounded-full bg-white/90 px-1.5 text-[9px]">{offer.badge}</span>
          )}
        </span>
        {offer.subtext && (
          <span className="text-[10px] text-slate-500">{offer.subtext}</span>
        )}
        {offer.kind === 'second_off' && (Number(item?.quantity) || 0) < 2 && (
          <SecondItemPriceHighlight item={item} isAr={isAr} compact className="w-full justify-start" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border font-semibold ${TONE_CLASS[offer.tone] || TONE_CLASS.orange} ${
        compact ? 'mt-1 px-2 py-1 text-[10px]' : 'mt-1.5 px-2.5 py-1.5 text-xs'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <Icon className={`mt-0.5 shrink-0 opacity-80 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">{offer.text}</p>
          {offer.subtext && (
            <p className={`mt-0.5 font-normal opacity-90 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
              {offer.subtext}
            </p>
          )}
        </div>
        {offer.badge && (
          <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold shadow-sm">
            {offer.badge}
          </span>
        )}
      </div>
      {offer.kind === 'second_off' && (Number(item?.quantity) || 0) < 2 && (
        <div className={`${compact ? 'mt-1' : 'mt-1.5'}`}>
          <SecondItemPriceHighlight item={item} isAr={isAr} compact={compact} className="w-full justify-center" />
        </div>
      )}
    </div>
  );
}
