/**
 * Bilingual / dialect synonym groups for the search engine. Every word in a group
 * matches the others, so "milk", "حليب" and "لبن" find the same products.
 * Words are stored pre-normalized (see utils/arabicNormalize.js): ة → ه, أ → ا, ى → ي.
 */
export const SEARCH_SYNONYM_GROUPS = [
  ['milk', 'حليب', 'لبن'],
  ['yogurt', 'yoghurt', 'زبادي', 'روب'],
  ['cheese', 'جبن', 'جبنه'],
  ['butter', 'زبده'],
  ['eggs', 'egg', 'بيض'],
  ['bread', 'عيش', 'خبز'],
  ['rice', 'رز', 'ارز'],
  ['pasta', 'مكرونه', 'معكرونه'],
  ['sugar', 'سكر'],
  ['salt', 'ملح'],
  ['oil', 'زيت'],
  ['tea', 'شاي'],
  ['coffee', 'قهوه', 'بن'],
  ['water', 'مياه', 'ميه', 'ماء'],
  ['juice', 'عصير'],
  ['chicken', 'فراخ', 'دجاج'],
  ['meat', 'لحمه', 'لحم'],
  ['beef', 'لحم بقري'],
  ['fish', 'سمك'],
  ['tomato', 'tomatoes', 'طماطم', 'قوطه'],
  ['potato', 'potatoes', 'بطاطس'],
  ['onion', 'onions', 'بصل'],
  ['apple', 'apples', 'تفاح'],
  ['banana', 'bananas', 'موز'],
  ['detergent', 'منظف', 'مسحوق'],
  ['shampoo', 'شامبو'],
  ['soap', 'صابون'],
  ['tissue', 'tissues', 'مناديل', 'كلينكس'],
  ['diapers', 'diaper', 'حفاضات', 'بامبرز'],
  ['chocolate', 'شوكولاته', 'شيكولاته'],
  ['biscuits', 'biscuit', 'بسكويت'],
  ['chips', 'شيبسي', 'شيبس'],
];

/** Expand groups into the `{ word: [synonyms] }` map Meilisearch expects. */
export function buildSynonymMap(groups = SEARCH_SYNONYM_GROUPS) {
  const map = {};
  for (const group of groups) {
    for (const word of group) {
      map[word] = [...new Set([...(map[word] || []), ...group.filter((w) => w !== word)])];
    }
  }
  return map;
}
