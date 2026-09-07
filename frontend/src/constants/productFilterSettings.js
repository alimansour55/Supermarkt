/** Storefront product filter section & source option definitions. */

export const PRODUCT_FILTER_SECTION_IDS = [
  'productSource',
  'mainCategory',
  'subCategory',
  'brand',
  'price',
  'rating',
  'discount',
  'quickFilters',
];

export const PRODUCT_SOURCE_OPTION_IDS = [
  'all',
  'our_products',
  'offers',
  'best_sellers',
  'new_arrivals',
];

export const DEFAULT_PRODUCT_FILTER_SECTIONS = [
  { id: 'productSource', enabled: true, sortOrder: 0 },
  { id: 'mainCategory', enabled: true, sortOrder: 1 },
  { id: 'subCategory', enabled: true, sortOrder: 2 },
  { id: 'brand', enabled: true, sortOrder: 3 },
  { id: 'price', enabled: true, sortOrder: 4 },
  { id: 'rating', enabled: true, sortOrder: 5 },
  { id: 'discount', enabled: true, sortOrder: 6 },
  { id: 'quickFilters', enabled: true, sortOrder: 7 },
];

export const DEFAULT_PRODUCT_SOURCE_OPTIONS = [
  {
    id: 'all',
    labelAr: 'كل المنتجات',
    labelEn: 'All products',
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 'our_products',
    labelAr: 'منتجاتنا',
    labelEn: 'Our products',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'offers',
    labelAr: 'عروض وخصومات',
    labelEn: 'Offers & discounts',
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'best_sellers',
    labelAr: 'الأكثر مبيعاً',
    labelEn: 'Best sellers',
    enabled: true,
    sortOrder: 3,
  },
  {
    id: 'new_arrivals',
    labelAr: 'وصل حديثاً',
    labelEn: 'New arrivals',
    enabled: true,
    sortOrder: 4,
  },
];

export const DEFAULT_PRODUCT_FILTER_SETTINGS = {
  sections: DEFAULT_PRODUCT_FILTER_SECTIONS,
  sourceOptions: DEFAULT_PRODUCT_SOURCE_OPTIONS,
};

export const PRODUCT_FILTER_SECTION_LABELS = {
  productSource: { ar: 'نوع المنتج', en: 'Product type' },
  mainCategory: { ar: 'القسم الرئيسي', en: 'Main category' },
  subCategory: { ar: 'القسم الفرعي', en: 'Subcategory' },
  brand: { ar: 'الماركة', en: 'Brand' },
  price: { ar: 'السعر (ج.م)', en: 'Price (EGP)' },
  rating: { ar: 'التقييم', en: 'Rating' },
  discount: { ar: 'الخصم', en: 'Discount' },
  quickFilters: { ar: 'خيارات سريعة', en: 'Quick filters' },
};
