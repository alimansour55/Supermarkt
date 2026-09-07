import { resolveApiBaseUrl } from './resolveApiBaseUrl.js';

export { resolveApiBaseUrl } from './resolveApiBaseUrl.js';
export const API_URL = resolveApiBaseUrl();

export const APP_NAME = 'سوق+';
export const APP_NAME_EN = 'MarketPlus';

export const STORAGE_KEYS = {
  TOKEN: 'marketplus_token',
  CART: 'marketplus_cart',
  LANGUAGE: 'marketplus_lang',
  DISCOUNT: 'marketplus_discount',
  APPLIED_COUPON: 'marketplus_applied_coupon',
  DELIVERY_METHOD: 'marketplus_delivery',
  PENDING_CART_MERGE: 'marketplus_pending_cart_merge',
  FAVORITES: 'marketplus_favorites',
  FAVORITE_PRODUCTS: 'marketplus_favorite_products',
  RECENT_SEARCHES: 'marketplus_recent_searches',
};

export const LANGUAGES = {
  AR: 'ar',
  EN: 'en',
};

export const CATEGORY_ICONS = {
  fruits: '🍎',
  dairy: '🥛',
  bakery: '🍞',
  meat: '🥩',
  beverages: '🥤',
  snacks: '🍿',
  cleaning: '🧹',
  personal: '🧴',
};

export const DEMO_CATEGORIES = [
  { id: 'fruits', nameAr: 'فواكه وخضروات', nameEn: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
  { id: 'dairy', nameAr: 'ألبان وجبن', nameEn: 'Dairy & Cheese', slug: 'dairy' },
  { id: 'bakery', nameAr: 'مخبوزات', nameEn: 'Bakery', slug: 'bakery' },
  { id: 'meat', nameAr: 'لحوم ودواجن', nameEn: 'Meat & Poultry', slug: 'meat' },
  { id: 'beverages', nameAr: 'مشروبات', nameEn: 'Beverages', slug: 'beverages' },
  { id: 'snacks', nameAr: 'سناكس', nameEn: 'Snacks', slug: 'snacks' },
  { id: 'cleaning', nameAr: 'منظفات', nameEn: 'Cleaning', slug: 'cleaning' },
  { id: 'personal', nameAr: 'عناية شخصية', nameEn: 'Personal Care', slug: 'personal-care' },
];
