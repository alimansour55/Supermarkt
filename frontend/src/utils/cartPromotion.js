/** Cart + checkout offer lines — all promotion types (qty, discount, badge). */

import {
  buildQtyPromoBadge,
  buildSecondItemBadge,
  isQtyPromoType,
  parseSecondPercentFromProduct,
} from './promotionDisplay';
import {
  resolveDiscountCartCopy,
  resolveGenericCartCopy,
  resolveQtyCartCopy,
  resolveQtyCartSubtext,
  resolveSecondItemCartCopy,
} from './cartPromoCopy';
import { getDiscountPercent } from './productHelpers';

function inferPromoType(item) {
  if (item?.promotionType) return item.promotionType;
  const badge = `${item?.offerBadgeAr || ''} ${item?.offerBadgeEn || ''}`.toLowerCase();
  if (/(\d)\+1|\d+\+\d+|bogo/.test(badge)) return 'buy_x_get_y';
  if (/second|الثاني|2nd/.test(badge)) return 'second_percent_off';
  if (item?.activePromotionId) return 'bogo';
  return null;
}

/** Parse "3+1", "3+1 ك.ل" → buy/get when DB fields missing. */
export function parseQtyFromBadge(item) {
  const raw = item?.offerBadgeAr || item?.offerBadgeEn || '';
  const m = String(raw).match(/(\d+)\+1\b/);
  if (m) return { buyQty: Number(m[1]), getQty: 1 };
  const m2 = String(raw).match(/(\d+)\+(\d+)/);
  if (m2) return { buyQty: Number(m2[1]), getQty: Number(m2[2]) };
  return { buyQty: 1, getQty: 1 };
}

export function resolveQtyPromoRules(item) {
  const parsed = parseQtyFromBadge(item);
  return {
    buyQty: Math.max(1, Number(item?.promotionBuyQty) || parsed.buyQty),
    getQty: Math.max(1, Number(item?.promotionGetQty) || parsed.getQty),
    unit: item?.promotionUnit || 'pieces',
  };
}

export function itemHasOfferSignal(item) {
  if (!item) return false;
  const discount = item.discountPercent ?? item.discount ?? getDiscountPercent({
    price: item.price,
    compareAtPrice: item.compareAtPrice ?? item.oldPrice,
    oldPrice: item.oldPrice,
  });
  return Boolean(
    item.promotionType
    || item.activePromotionId
    || item.offerBadgeAr
    || item.offerBadgeEn
    || item.isOffer
    || discount > 0
    || (item.oldPrice && Number(item.oldPrice) > Number(item.price))
    || (item.compareAtPrice && Number(item.compareAtPrice) > Number(item.price))
  );
}

export function mergePromoFieldsFromProduct(item, product) {
  if (!item || !product) return item;
  return {
    ...item,
    price: product.price ?? item.price,
    oldPrice: product.oldPrice ?? product.compareAtPrice ?? item.oldPrice ?? null,
    compareAtPrice: product.compareAtPrice ?? product.oldPrice ?? item.compareAtPrice ?? null,
    discount: product.discount ?? item.discount ?? null,
    discountPercent: product.discountPercent ?? product.discount ?? item.discountPercent ?? null,
    isOffer: product.isOffer ?? item.isOffer,
    activePromotionId: product.activePromotionId ?? item.activePromotionId ?? null,
    promotionType: product.promotionType || inferPromoType(product) || inferPromoType(item) || item.promotionType || null,
    offerBadgeAr: product.offerBadgeAr ?? item.offerBadgeAr ?? null,
    offerBadgeEn: product.offerBadgeEn ?? item.offerBadgeEn ?? null,
    promotionBuyQty: product.promotionBuyQty ?? item.promotionBuyQty ?? null,
    promotionGetQty: product.promotionGetQty ?? item.promotionGetQty ?? null,
    promotionUnit: product.promotionUnit ?? item.promotionUnit ?? 'pieces',
    promotionCartLineAr: product.promotionCartLineAr ?? item.promotionCartLineAr ?? null,
    promotionCartLineEn: product.promotionCartLineEn ?? item.promotionCartLineEn ?? null,
    promotionCartProgressAr: product.promotionCartProgressAr ?? item.promotionCartProgressAr ?? null,
    promotionCartProgressEn: product.promotionCartProgressEn ?? item.promotionCartProgressEn ?? null,
    promotionCartSubtextAr: product.promotionCartSubtextAr ?? item.promotionCartSubtextAr ?? null,
    promotionCartSubtextEn: product.promotionCartSubtextEn ?? item.promotionCartSubtextEn ?? null,
    promotionSecondPercentOff: product.promotionSecondPercentOff ?? item.promotionSecondPercentOff ?? null,
  };
}

export function getCartPromoBreakdown(item) {
  const type = inferPromoType(item);
  if (!item || !type || !isQtyPromoType(type)) return null;

  const paidQty = Math.max(0, Number(item.quantity) || 0);
  if (paidQty <= 0) return null;

  const { buyQty, getQty, unit } = resolveQtyPromoRules(item);
  const sets = Math.floor(paidQty / buyQty);
  const freeQty = sets * getQty;

  return {
    type,
    paidQty,
    freeQty,
    totalQty: paidQty + freeQty,
    buyQty,
    getQty,
    badge: item.offerBadgeAr || item.offerBadgeEn || buildQtyPromoBadge(buyQty, getQty, unit, true),
    unit,
  };
}

/** Physical units needed in stock (paid + free gifts). */
export function getCartLineStockUnits(item, quantity = item?.quantity) {
  const qty = Math.max(0, Number(quantity) || 0);
  if (!qty) return 0;
  const breakdown = getCartPromoBreakdown({ ...item, quantity: qty });
  return breakdown ? breakdown.totalQty : qty;
}

export function describeCartPromoLine(breakdown, item, isAr) {
  if (!breakdown || breakdown.freeQty <= 0) return null;
  const badge = isAr
    ? (item?.offerBadgeAr || breakdown.badge)
    : (item?.offerBadgeEn || breakdown.badge);
  return resolveQtyCartCopy(item, {
    paidQty: breakdown.paidQty,
    freeQty: breakdown.freeQty,
    totalQty: breakdown.totalQty,
    need: 0,
    buyQty: breakdown.buyQty,
    getQty: breakdown.getQty,
    unit: breakdown.unit || 'pieces',
    badge,
    isAr,
    variant: 'earned',
  });
}

/**
 * Unified per-line offer display for cart drawer, cart page, checkout.
 * Returns { kind, text, badge, tone, subtext } or null.
 */
export function getCartOfferLine(item, isAr = true) {
  if (!item || !itemHasOfferSignal(item)) return null;

  const breakdown = getCartPromoBreakdown(item);
  const type = inferPromoType(item);

  if (breakdown?.freeQty > 0) {
    const badge = isAr ? (item.offerBadgeAr || breakdown.badge) : (item.offerBadgeEn || breakdown.badge);
    return {
      kind: 'qty',
      text: describeCartPromoLine(breakdown, item, isAr),
      badge,
      subtext: resolveQtyCartSubtext(item, {
        buyQty: breakdown.buyQty,
        getQty: breakdown.getQty,
        unit: breakdown.unit,
        badge,
        isAr,
      }),
      tone: 'violet',
    };
  }

  if (isQtyPromoType(type)) {
    const { buyQty, getQty, unit } = resolveQtyPromoRules(item);
    const paidQty = Number(item.quantity) || 0;
    const badge = isAr
      ? (item.offerBadgeAr || buildQtyPromoBadge(buyQty, getQty, unit, true))
      : (item.offerBadgeEn || buildQtyPromoBadge(buyQty, getQty, unit, false));
    const remainder = paidQty % buyQty;
    const need = remainder === 0 ? buyQty : buyQty - remainder;

    if (paidQty > 0 && paidQty < buyQty) {
      return {
        kind: 'qty_progress',
        text: resolveQtyCartCopy(item, {
          paidQty,
          freeQty: 0,
          totalQty: paidQty,
          need,
          buyQty,
          getQty,
          unit,
          badge,
          isAr,
          variant: 'progress',
        }),
        badge,
        subtext: resolveQtyCartSubtext(item, { buyQty, getQty, unit, badge, isAr }),
        tone: 'violet',
      };
    }
  }

  const discount = item.discountPercent ?? item.discount ?? getDiscountPercent({
    price: item.price,
    compareAtPrice: item.compareAtPrice ?? item.oldPrice,
    oldPrice: item.oldPrice,
  });

  if (discount > 0 && type !== 'second_percent_off') {
    return {
      kind: 'discount',
      text: resolveDiscountCartCopy(item, discount, isAr),
      badge: `-${discount}%`,
      subtext: resolveQtyCartSubtext(item, {
        buyQty: 0,
        getQty: 0,
        unit: 'pieces',
        badge: isAr ? item.offerBadgeAr : item.offerBadgeEn,
        isAr,
      }),
      tone: 'red',
    };
  }

  if (type === 'second_percent_off') {
    const secondOff = parseSecondPercentFromProduct(item);
    const unit = item.promotionUnit || 'pieces';
    const qty = Number(item.quantity) || 0;
    return {
      kind: 'second_off',
      text: resolveSecondItemCartCopy(item, secondOff, qty, isAr),
      badge: buildSecondItemBadge(secondOff, isAr, unit),
      subtext: qty >= 2 ? null : resolveQtyCartSubtext(item, {
        buyQty: 0,
        getQty: 0,
        unit,
        badge: buildSecondItemBadge(secondOff, isAr, unit),
        isAr,
      }),
      tone: 'amber',
    };
  }

  const badge = isAr
    ? (item.offerBadgeAr || item.offerBadgeEn || 'عرض')
    : (item.offerBadgeEn || item.offerBadgeAr || 'Offer');

  if (item.promotionType || item.offerBadgeAr || item.offerBadgeEn || item.isOffer) {
    return {
      kind: 'badge',
      text: resolveGenericCartCopy(item, isAr),
      badge,
      subtext: resolveQtyCartSubtext(item, {
        buyQty: 0,
        getQty: 0,
        unit: 'pieces',
        badge,
        isAr,
      }),
      tone: 'orange',
    };
  }

  return null;
}

export function summarizeCartOffers(items = [], isAr = true) {
  let paidUnits = 0;
  let freeUnits = 0;
  let hasQtyPromo = false;
  let hasAnyOffer = false;
  const promoLines = [];
  const offerLines = [];

  items.forEach((item) => {
    const line = getCartOfferLine(item, isAr);
    if (line) {
      hasAnyOffer = true;
      offerLines.push({ item, line });
    }
    const breakdown = getCartPromoBreakdown(item);
    if (breakdown?.freeQty > 0) {
      hasQtyPromo = true;
      paidUnits += breakdown.paidQty;
      freeUnits += breakdown.freeQty;
      promoLines.push({ item, breakdown });
    } else {
      paidUnits += Number(item.quantity) || 0;
    }
  });

  const summaryLabel = hasQtyPromo
    ? (isAr
      ? `${paidUnits} مدفوعة + ${freeUnits} هدية = ${paidUnits + freeUnits} قطع إجمالاً`
      : `${paidUnits} paid + ${freeUnits} free = ${paidUnits + freeUnits} total pieces`)
    : null;

  return {
    hasQtyPromo,
    hasAnyOffer,
    paidUnits,
    freeUnits,
    totalPieces: paidUnits + freeUnits,
    promoLines,
    offerLines,
    summaryLabel,
  };
}

/** @deprecated use summarizeCartOffers */
export const summarizeCartPromotions = summarizeCartOffers;

export function getCheckoutPromoReassurance(items, isAr) {
  const summary = summarizeCartOffers(items, isAr);
  if (!summary.hasAnyOffer) return null;

  const parts = [];
  if (summary.hasQtyPromo) {
    parts.push(
      isAr
        ? '✓ العروض الكمية (1+1، 3+1…): القطع المجانية تُشحن مع الطلب — تدفع المدفوع فقط.'
        : '✓ Quantity deals (BOGO, 3+1…): free items ship with your order — you pay for paid qty only.',
    );
  }
  const hasSecondOff = summary.offerLines.some((l) => l.line.kind === 'second_off');
  if (hasSecondOff) {
    parts.push(
      isAr
        ? '✓ عرض «الثاني أرخص»: الخصم على كل قطعة ثانية (2، 4، 6…) في نفس المنتج.'
        : '✓ 2nd-item-off: discount applies to every 2nd unit (2nd, 4th, 6th…) of the same item.',
    );
  }
  const hasDiscount = summary.offerLines.some((l) => l.line.kind === 'discount');
  if (hasDiscount) {
    parts.push(
      isAr
        ? '✓ أسعار الخصم المعروضة مُطبّقة — الخصم يظهر في إجمالي السلة.'
        : '✓ Sale prices are applied — discounts are reflected in your cart total.',
    );
  }
  if (parts.length === 0) {
    parts.push(
      isAr
        ? '✓ العروض النشطة مُطبّقة على منتجاتك.'
        : '✓ Active offers are applied to your items.',
    );
  }
  return parts.join(' ');
}
