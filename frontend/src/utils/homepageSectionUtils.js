/** Storefront helpers for homepage CMS sections. */
export {
  productSectionCompact,
  productSectionLayout,
  dealSectionShowsCountdown,
  resolveDealCountdownEnd,
  normalizeDealConfig,
  isDealSectionType,
} from './dealSectionShared';

export const HOMEPAGE_CTA_TYPES = [
  'cta_card',
  'signup_promo',
  'favorites_promo',
  'track_order_promo',
  'offers_banner',
  'faq_teaser',
  'all_products_entry',
];

export const HOMEPAGE_PRODUCT_TYPES = [
  'daily_offers',
  'flash_sale',
  'product_carousel',
  'product_grid',
  'category_spotlight',
  'top_rated',
];
