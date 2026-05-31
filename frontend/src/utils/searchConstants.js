/** Popular supermarket searches (query token matches product/category text). */
export const POPULAR_SEARCHES = [
  { query: 'milk', labelAr: 'لبن', labelEn: 'milk' },
  { query: 'bread', labelAr: 'عيش', labelEn: 'bread' },
  { query: 'rice', labelAr: 'أرز', labelEn: 'rice' },
  { query: 'chicken', labelAr: 'دجاج', labelEn: 'chicken' },
  { query: 'eggs', labelAr: 'بيض', labelEn: 'eggs' },
];

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_SUGGESTION_LIMIT = 5;
export const SEARCH_CATEGORY_LIMIT = 3;
export const MAX_RECENT_SEARCHES = 8;
