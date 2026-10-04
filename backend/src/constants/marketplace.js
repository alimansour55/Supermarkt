/** Marketplace (third-party sellers) — single source of truth for statuses and roles. */

/** Seller account roles. Sellers are NOT staff: they never reach the admin panel. */
export const SELLER_ROLES = ['seller_owner', 'seller_staff'];

export function isSellerRole(role) {
  return SELLER_ROLES.includes(role);
}

/** Seller business lifecycle. Only `active` sellers have products on the storefront. */
export const SELLER_STATUSES = ['applied', 'under_review', 'active', 'suspended', 'rejected'];

export const SELLER_STATUS_META = {
  applied: { labelAr: 'طلب جديد', labelEn: 'Applied' },
  under_review: { labelAr: 'قيد المراجعة', labelEn: 'Under review' },
  active: { labelAr: 'نشط', labelEn: 'Active' },
  suspended: { labelAr: 'موقوف', labelEn: 'Suspended' },
  rejected: { labelAr: 'مرفوض', labelEn: 'Rejected' },
};

/**
 * Listing moderation for seller products. Store-owned products are always `approved`.
 * A seller product is visible (`isActive`) only when approved and its seller isn't suspended.
 */
export const LISTING_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'paused'];

export const LISTING_STATUS_META = {
  draft: { labelAr: 'مسودة', labelEn: 'Draft' },
  pending_review: { labelAr: 'بانتظار المراجعة', labelEn: 'Pending review' },
  approved: { labelAr: 'معتمد', labelEn: 'Approved' },
  rejected: { labelAr: 'مرفوض', labelEn: 'Rejected' },
  paused: { labelAr: 'متوقف مؤقتاً', labelEn: 'Paused' },
};

/** Who packs and delivers an item: the store's own fulfillment, or the seller. */
export const FULFILLMENT_MODES = ['store', 'seller'];

/**
 * Product fields a seller may edit. Merchandising flags (featured, best-seller, our-product,
 * promotions), slug, ratings and counters stay staff-only.
 */
export const SELLER_CONTENT_FIELDS = [
  'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn',
  'mainCategory', 'category', 'brand', 'size', 'unit', 'unitAr', 'unitEn',
  'searchKeywordsAr', 'searchKeywordsEn', 'specs', 'emoji', 'barcode',
];

/** Operational fields — applied immediately, even on an approved (live) listing. */
export const SELLER_OPERATIONAL_FIELDS = ['price', 'oldPrice', 'stock', 'variants', 'sku', 'fulfilledBy'];

export const SELLER_EDITABLE_FIELDS = [...SELLER_CONTENT_FIELDS, ...SELLER_OPERATIONAL_FIELDS];

/** Seller document types collected during onboarding (Egypt). */
export const SELLER_DOCUMENT_TYPES = ['commercial_register', 'tax_card', 'national_id', 'bank_letter', 'other'];

export const SELLER_DOCUMENT_META = {
  commercial_register: { labelAr: 'السجل التجاري', labelEn: 'Commercial register' },
  tax_card: { labelAr: 'البطاقة الضريبية', labelEn: 'Tax card' },
  national_id: { labelAr: 'بطاقة الرقم القومي', labelEn: 'National ID' },
  bank_letter: { labelAr: 'خطاب البنك', labelEn: 'Bank letter' },
  other: { labelAr: 'مستند آخر', labelEn: 'Other document' },
};

export const DEFAULT_MARKETPLACE_SETTINGS = {
  enabled: true,
  registrationOpen: true,
  /** Commission % taken on each seller sale when no category / seller override applies. */
  defaultCommissionRate: 10,
  /** Days after delivery before a sale becomes payable (covers the return window). */
  payoutHoldDays: 14,
  /** Flat fee per unit when the store fulfills a seller's item. */
  storeFulfillmentFeePerItem: 0,
  /** Delivery fee charged per seller-shipped shipment (seller ships = seller's own fee). */
  sellerShipmentDeliveryFee: 30,
  /** Content edits on a live listing wait for staff approval instead of going live. */
  reviewContentEdits: true,
  minPayoutAmount: 100,
};
