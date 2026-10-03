import { fetchSearchSuggestions, fetchTrendingSearches, trackSearchEvent } from '../services/searchApi';
import { fetchProductsPaginated, fetchCategoryBrowse, fetchProductsByCategoryPath, fetchTodaysDeals, fetchBestSellers, fetchNewArrivals } from '../services/productApi';
import { orderService } from '../services/apiServices';
import { formatPrice, formatRelativeTime } from './formatters';
import { buildContactInfoRows, buildContactQuickActions } from './contactInfo';
import { formatOrderNumber } from './orderNumber';
import { getOrderStatusLabel, normalizeOrderStatus, getOrderStatusMeta } from './orderStatus';
import { getProductAvailableStock } from './productHelpers';
import { canCustomerEditOrder, getOrderEditBlockReason } from './orderEditHelpers';
import { POPULAR_SEARCHES } from './searchConstants';
import { categoryLabel, getChildCategories } from './categoryHelpers';
import {
  DELIVERY_METHODS,
  buildRecurringScheduleSummary,
  computeFirstRecurringDeliveryDate,
  defaultBookingDate,
} from '../constants/deliveryOptions';
import {
  filterAvailableSlots,
  getEarliestBooking,
  isExpressAvailableNow,
  resolveSelectedSlot,
} from './deliverySlotAvailability';
import { resolveDeliveryLeadMinutes } from './deliveryLeadTime';
import {
  parseFreeDeliveryMethodsFromApi,
  resolveDeliveryFee,
} from './freeDelivery';

export const FLOWS = {
  MENU: 'menu',
  SEARCH: 'search',
  BROWSE: 'browse',
  ORDERS: 'orders',
  ORDER_DETAIL: 'order_detail',
  CHECKOUT: 'checkout',
  GOODBYE: 'goodbye',
};

const CANCELABLE = new Set(['pending', 'confirmed', 'preparing']);

const CHECKOUT_STEPS_TOTAL = 5;

export const CHECKOUT_PANEL_LAYOUTS = new Set([
  'checkout_addresses',
  'checkout_delivery',
  'checkout_delivery_schedule',
  'checkout_payment',
  'checkout_confirm',
  'address_form',
]);

export function mergeCheckoutChatMessages(prevMessages, incomingMessages, nextState) {
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) return prevMessages;
  const inCheckout = nextState?.flow === FLOWS.CHECKOUT;
  const hasCheckoutPanel = incomingMessages.some((message) => CHECKOUT_PANEL_LAYOUTS.has(message.layout));
  if (!inCheckout && !hasCheckoutPanel) {
    return [...prevMessages, ...incomingMessages];
  }
  if (!hasCheckoutPanel) {
    return [...prevMessages, ...incomingMessages];
  }
  const kept = prevMessages.filter((message) => !CHECKOUT_PANEL_LAYOUTS.has(message.layout));
  return [...kept, ...incomingMessages];
}

/** Arabic ↔ English grocery synonyms for smarter chat search */
const SEARCH_SYNONYMS = {
  حليب: 'milk',
  لبن: 'milk',
  عيش: 'bread',
  خبز: 'bread',
  أرز: 'rice',
  رز: 'rice',
  دجاج: 'chicken',
  بيض: 'eggs',
  مياه: 'water',
  ماء: 'water',
  سكر: 'sugar',
  زيت: 'oil',
  شاي: 'tea',
  قهوة: 'coffee',
  جبن: 'cheese',
  منظف: 'detergent',
  صابون: 'soap',
  بيبسي: 'pepsi',
  كوكا: 'cola',
  عصير: 'juice',
  موز: 'banana',
  تفاح: 'apple',
  طماطم: 'tomato',
  بطاطس: 'potato',
  بصل: 'onion',
};

const ARABIC_RE = /[\u0600-\u06FF]/;

function productName(product, isAr) {
  if (!product) return '';
  return isAr
    ? (product.nameAr || product.name || product.nameEn || '')
    : (product.nameEn || product.name || product.nameAr || '');
}

function msg(id, role, text, extras = {}) {
  return { id, role, text, at: Date.now(), ...extras };
}

function menuActions(isAr) {
  return [
    { id: 'search', label: isAr ? 'ابحث واشتري' : 'Search & buy', icon: 'search', variant: 'primary' },
    { id: 'browse_shop', label: isAr ? 'تسوق الآن' : 'Shop now', icon: 'browse' },
    { id: 'orders', label: isAr ? 'طلباتي' : 'My orders', icon: 'orders' },
    { id: 'cart', label: isAr ? 'السلة' : 'Cart', icon: 'cart' },
    { id: 'delivery', label: isAr ? 'التوصيل' : 'Delivery', icon: 'delivery' },
    { id: 'contact', label: isAr ? 'تواصل معنا' : 'Contact us', icon: 'contact' },
  ];
}

function navActions(isAr, { showBack = true } = {}) {
  const actions = [
    { id: 'menu', label: isAr ? 'القائمة الرئيسية' : 'Main menu', icon: 'menu' },
  ];
  if (showBack) {
    actions.unshift({ id: 'back', label: isAr ? 'رجوع' : 'Back', icon: 'back' });
  }
  return actions;
}

function goodbyeText(isAr) {
  return isAr
    ? 'شكراً لزيارتك! نتمنى لك يوماً سعيداً. يمكنك فتح المحادثة في أي وقت.'
    : 'Thanks for visiting! Have a wonderful day. Open the chat anytime.';
}

const CONVERSATIONAL_ONLY = new Set([
  'good', 'morning', 'evening', 'night', 'hello', 'hi', 'hey', 'thanks', 'thank', 'you',
  'ok', 'okay', 'yes', 'no', 'please', 'help', 'test', 'why', 'what', 'how', 'when', 'where',
  'صباح', 'مساء', 'مرحبا', 'اهلا', 'أهلا', 'هلا', 'سلام', 'شكرا', 'نعم', 'لا', 'هاي',
]);

const CONVERSATIONAL_PHRASES = [
  /^(good\s+(morning|evening|afternoon|night)|how\s+are\s+you|thank\s*you|thanks)$/i,
  /^(سلام\s*عليكم|السلام\s*عليكم|وعليكم\s*السلام|عليكم\s*السلام)$/i,
  /^(مرحبا|مرحباً|اهلا|أهلا|هلا|هاي|السلام)$/i,
  /^(salam\s*alaykum|assalamu?\s*alaykum|peace\s*be\s*upon\s*you)$/i,
];

const INTENT_PATTERNS = [
  {
    intent: 'greeting',
    re: /^(hi+|hello+|hey+|hiya|yo|good\s*(morning|evening|afternoon|night)|g\s*(m|n|d)|marhaba|ahlan|salam\s*alaykum|assalamu?\s*alaykum|salam|assalam|سلام\s*عليكم|وعليكم\s*السلام|عليكم\s*السلام|السلام\s*عليكم|السلام|مرحبا?|مرحب|اهلا|أهلا|هلا|هاي|صباح\s*الخير|صباح|مساء\s*الخير|مساء)/i,
  },
  {
    intent: 'small_talk',
    re: /^(how\s*are\s*you|how\s*r\s*u|what'?s\s*up|whats\s*up|sup|nice\s*to\s*meet|كيف\s*حال|كيفك|شلونك|اخبارك|ايش\s*اخبارك|ازيك|عامل\s*ايه|بحبك|احبك|انا\s*بحبك|i\s*love\s*you|love\s*you|قارن|قارنلي|قارن\s*لي|compare)/i,
  },
  {
    intent: 'thanks',
    re: /^(thanks?|thank\s*you|thx|ty|much\s*appreciated|شكر|مشكور|تسلم|يعطيك\s*العافية)!*$/i,
  },
  { intent: 'goodbye', re: /^(bye|goodbye|see\s*you|take\s*care|مع\s*السلامة|وداع|سلام\s*$)/i },
  { intent: 'menu', re: /(menu|home|main|القائمة|الرئيسية|البداية)/i },
  { intent: 'back', re: /^(back|previous|رجوع|السابق|ارجع)/i },
  { intent: 'cart', re: /(cart|basket|سلة|السلة|عربة)/i },
  { intent: 'checkout', re: /(checkout|place\s*order|confirm\s*order|buy\s*now|complete\s*purchase|إتمام\s*الشراء|اكمل\s*الشراء|أكمل\s*الشراء|تأكيد\s*الطلب|اشتري\s*الآن|الدفع)/i },
  { intent: 'delivery', re: /(delivery|shipping|deliver|توصيل|شحن|موعد)/i },
  {
    intent: 'help',
    re: /(need\s+help|want\s+help|help\s*me|i\s+need\s+(help|assistance)|^(اريد|أريد|عايز|محتاج|ابغى|ابي)\s*(ال)?(مساعدة|مساعده)|^(مساعدة|مساعده|ساعدني|ساعدوني)$)/i,
  },
  { intent: 'contact', re: /(contact(\s+us)?|support|call|phone|whatsapp|دعم|اتصل|تواصل|واتصل|واتس|هاتف)/i },
  { intent: 'cancel', re: /(cancel.*order|الغاء.*طلب|إلغاء.*طلب|الغي.*طلب)/i },
  { intent: 'edit', re: /(edit.*order|change.*order|modify.*order|تعديل.*طلب|غير.*طلب)/i },
  { intent: 'track', re: /(track|where.*order|order.*status|تتبع|وين.*طلب|حالة.*طلب|متابعة.*طلب)/i },
  { intent: 'orders', re: /(my\s*orders|orders|طلباتي|طلبات|طلبي)/i },
  { intent: 'shop', re: /(shop\s*now|start\s*shopping|browse\s*(shop|store)|collections?|categories|تسوق\s*الآن|تسوق|أقسام|الأقسام|تصفح\s*المتجر)/i },
  { intent: 'price', re: /(price|how\s*much|cost|كم|سعر|بكام|بكم)/i },
  { intent: 'buy', re: /(buy|need|want|get|search|looking\s*for|ابغى|ابي|عايز|أريد|محتاج|ابحث|اشتري|شراء)/i },
];

function detectIntent(text) {
  const q = String(text || '').trim();
  if (!q) return 'unknown';
  for (const { intent, re } of INTENT_PATTERNS) {
    if (re.test(q)) return intent;
  }
  return 'free_text';
}

/** True for greetings, thanks, goodbye, small talk — should never trigger product search */
export function isConversationalMessage(text) {
  const intent = detectIntent(text);
  if (intent === 'greeting' || intent === 'small_talk' || intent === 'thanks' || intent === 'goodbye' || intent === 'help') {
    return true;
  }
  const q = String(text || '').trim();
  return /^(بحبك|احبك|انا\s*بحبك|i\s*love\s*you|love\s*you|قارن|قارنلي|قارن\s*لي|compare)/i.test(q);
}

const LOCAL_CHAT_INTENTS = new Set([
  'menu', 'back', 'cart', 'checkout', 'delivery', 'help', 'contact',
  'cancel', 'edit', 'track', 'orders', 'shop',
]);

const LOCAL_MENU_LABELS = {
  ar: {
    'تسوق الآن': 'browse_shop',
    'تسوق': 'browse_shop',
    'طلباتي': 'orders',
    'طلبات': 'orders',
    'السلة': 'cart',
    'سلة': 'cart',
    'التوصيل': 'delivery',
    'تواصل معنا': 'contact',
    'تواصل': 'contact',
    'ابحث واشتري': 'search',
    'القائمة الرئيسية': 'menu',
    'القائمة': 'menu',
    'إتمام الشراء': 'checkout_ai',
    'اكمل الشراء': 'checkout_ai',
    'أكمل الشراء': 'checkout_ai',
  },
  en: {
    'shop now': 'browse_shop',
    'shop': 'browse_shop',
    'my orders': 'orders',
    'orders': 'orders',
    'cart': 'cart',
    'delivery': 'delivery',
    'contact us': 'contact',
    'contact': 'contact',
    'search & buy': 'search',
    'main menu': 'menu',
    'menu': 'menu',
    'checkout': 'checkout_ai',
    'complete purchase': 'checkout_ai',
  },
};

const INTENT_TO_ACTION = {
  menu: 'menu',
  back: 'back',
  cart: 'cart',
  checkout: 'checkout_ai',
  delivery: 'delivery',
  help: 'menu',
  contact: 'contact',
  orders: 'orders',
  track: 'orders',
  cancel: 'orders',
  edit: 'orders',
  shop: 'browse_shop',
};

/** Map typed menu phrases / navigation intents to rule-engine action ids (never send these to AI). */
export function resolveLocalChatAction(text, isAr = true) {
  const q = String(text || '').trim();
  if (!q) return null;

  const normalized = q.replace(/[!?.،,]+$/g, '').trim();
  const labels = isAr ? LOCAL_MENU_LABELS.ar : LOCAL_MENU_LABELS.en;
  if (labels[normalized]) return labels[normalized];

  const lower = normalized.toLowerCase();
  if (!isAr && labels[lower]) return labels[lower];

  const intent = detectIntent(normalized);
  if (LOCAL_CHAT_INTENTS.has(intent)) {
    return INTENT_TO_ACTION[intent] || null;
  }

  return null;
}

const NON_PRODUCT_QUERY = /مساعدة|مساعده|مساعد|ساعدني|ساعدوني|help|support|طلباتي|طلبات|توصيل|شحن|دعم|اتصل|واتس|بحبك|احبك|قارن|compare|love\s*you/i;

function isLikelyProductQuery(query) {
  const q = String(query || '').trim();
  if (!q || q.length < 2) return false;
  const normalized = q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (isConversationalMessage(normalized)) return false;
  if (CONVERSATIONAL_PHRASES.some((re) => re.test(normalized))) return false;
  if (NON_PRODUCT_QUERY.test(normalized)) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 1 && CONVERSATIONAL_ONLY.has(words[0])) return false;
  return true;
}

function contextualGreetingText(isAr, userName, rawText = '') {
  const q = String(rawText || '').trim().toLowerCase();
  const name = userName ? (isAr ? ` ${userName}` : ` ${userName}`) : '';
  let timeGreeting = isAr ? `أهلاً${name}! 👋` : `Hello${name}! 👋`;
  if (/سلام|salam|assalam|alaykum|عليكم/i.test(q)) {
    timeGreeting = isAr ? `وعليكم السلام${name}! 🌟` : `Peace be upon you${name}! 🌟`;
  } else if (/evening|مساء\s*الخير|مساء\s*النور/i.test(q)) {
    timeGreeting = isAr ? `مساء الخير${name}! 🌙` : `Good evening${name}! 🌙`;
  } else if (/night|ليل/i.test(q)) {
    timeGreeting = isAr ? `تصبح على خير${name}! 🌙` : `Good night${name}! 🌙`;
  } else if (/morning|صباح/i.test(q)) {
    timeGreeting = isAr ? `صباح الخير${name}! ☀️` : `Good morning${name}! ☀️`;
  } else if (/afternoon/i.test(q)) {
    timeGreeting = isAr ? `مساء الخير${name}!` : `Good afternoon${name}!`;
  }
  const followUp = isAr
    ? 'كيف أقدر أساعدك؟ اكتب اسم منتج، أو اختر من القائمة.'
    : 'How can I help? Type a product name or pick an option below.';
  return `${timeGreeting}\n\n${followUp}`;
}

function normalizeSearchText(text) {
  return String(text || '')
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function expandSearchQueries(rawQuery, _isAr) {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];

  const variants = new Set([normalized, rawQuery.trim()]);

  // Whole-query synonym (Arabic → English API index)
  Object.entries(SEARCH_SYNONYMS).forEach(([ar, en]) => {
    if (normalized.includes(ar)) variants.add(en);
    if (normalized.includes(en)) variants.add(ar);
  });

  // Per-token synonyms
  normalized.split(' ').forEach((token) => {
    if (token.length < 2) return;
    if (SEARCH_SYNONYMS[token]) variants.add(SEARCH_SYNONYMS[token]);
    Object.entries(SEARCH_SYNONYMS).forEach(([ar, en]) => {
      if (token === ar) variants.add(en);
      if (token === en) variants.add(ar);
    });
  });

  // Shorter fallback: drop first word ("أريد حليب" → "حليب")
  const words = normalized.split(' ').filter((w) => w.length >= 2);
  if (words.length > 1) {
    variants.add(words.slice(1).join(' '));
    variants.add(words[words.length - 1]);
  }

  // Transliterate hint: if Arabic-only, also try synonym values
  if (ARABIC_RE.test(normalized)) {
    words.forEach((w) => {
      if (SEARCH_SYNONYMS[w]) variants.add(SEARCH_SYNONYMS[w]);
    });
  }

  return [...variants].filter((v) => v.length >= 2).slice(0, 8);
}

function scoreProduct(product, query, _isAr) {
  const q = normalizeSearchText(query);
  const names = [
    product.nameAr,
    product.nameEn,
    product.name,
    product.brand,
    product.slug,
  ].filter(Boolean).map((s) => normalizeSearchText(s));

  let score = 0;
  for (const name of names) {
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 80;
    else if (name.includes(q)) score += 50;
    else if (q.split(' ').some((w) => w.length >= 2 && name.includes(w))) score += 25;
  }

  const stock = getProductAvailableStock(product);
  if (stock != null && stock > 0) score += 10;
  if (product.isOffer) score += 5;

  return score;
}

function stockMeta(product, isAr) {
  const stock = getProductAvailableStock(product);
  if (stock == null) return { label: isAr ? 'متوفر' : 'In stock', tone: 'ok' };
  if (stock <= 0) return { label: isAr ? 'غير متوفر' : 'Out of stock', tone: 'out' };
  if (stock <= 5) return { label: isAr ? `${stock} متبقي` : `${stock} left`, tone: 'low' };
  return { label: isAr ? 'متوفر' : 'In stock', tone: 'ok' };
}

export function createInitialChatState() {
  return {
    flow: FLOWS.MENU,
    stack: [],
    products: [],
    orders: [],
    selectedOrder: null,
    lastQuery: '',
    browsePath: '',
    shopView: null,
    checkoutDraft: null,
  };
}

function categoryHasKids(cat, categories = []) {
  if (cat?.children?.length) return true;
  if (cat?.isLeaf === false) return true;
  return getChildCategories(categories, cat?.slug || cat?._id).length > 0;
}

function mapBrowseCategory(cat, parentSlugPath, isAr, categories = []) {
  const slugPath = parentSlugPath ? `${parentSlugPath}/${cat.slug}` : cat.slug;
  const hasChildren = categoryHasKids(cat, categories);
  return {
    slug: cat.slug,
    slugPath,
    name: categoryLabel(cat, isAr),
    icon: cat.icon,
    image: cat.image,
    color: cat.color,
    hasChildren,
    subtitle: hasChildren
      ? (isAr ? 'تصفح الأقسام الفرعية' : 'Browse subcategories')
      : (isAr ? 'عرض المنتجات' : 'View products'),
  };
}

function getShopCollectionCards(isAr) {
  return [
    {
      id: 'deals',
      name: isAr ? 'عروض اليوم' : "Today's deals",
      desc: isAr ? 'خصومات لفترة محدودة' : 'Limited-time offers',
    },
    {
      id: 'best_sellers',
      name: isAr ? 'الأكثر مبيعاً' : 'Best sellers',
      desc: isAr ? 'الأكثر طلباً من عملائنا' : 'Customer favorites',
    },
    {
      id: 'new_arrivals',
      name: isAr ? 'وصل حديثاً' : 'New arrivals',
      desc: isAr ? 'منتجات جديدة في المتجر' : 'Fresh in store',
    },
    {
      id: 'categories',
      name: isAr ? 'تصفح الأقسام' : 'Browse categories',
      desc: isAr ? 'اختر من أقسام المتجر' : 'Shop by department',
      actionId: 'browse_categories',
    },
  ];
}

function findCategoryBySlug(categories, slug) {
  return (categories || []).find((c) => c.slug === slug);
}

function buildBrowseBreadcrumb(slugPath, categories, isAr) {
  const shopLabel = isAr ? 'تسوق' : 'Shop';
  if (!slugPath) {
    return [{ label: shopLabel, path: '' }];
  }
  const segments = String(slugPath).split('/').filter(Boolean);
  const crumbs = [{ label: shopLabel, path: '' }];
  let acc = '';
  segments.forEach((seg) => {
    acc = acc ? `${acc}/${seg}` : seg;
    const cat = findCategoryBySlug(categories, seg);
    crumbs.push({
      label: cat ? categoryLabel(cat, isAr) : seg,
      path: acc,
    });
  });
  return crumbs;
}

function shopCompactActions(isAr) {
  return [
    { id: 'browse_shop', label: isAr ? 'مجموعات أخرى' : 'More collections', icon: 'browse' },
  ];
}

function buildShopNowReply(state, isAr) {
  return {
    messages: [
      msg('bot-shop-now', 'bot', '', {
        layout: 'shop_collections',
        sectionTitle: isAr ? 'تسوق الآن' : 'Shop now',
        sectionSubtitle: isAr ? 'ابحث بالاسم أو اختر من المقترحات' : 'Search by name or pick a collection',
        shopCollections: getShopCollectionCards(isAr),
        actions: [],
      }),
    ],
    state: {
      ...pushFlow(state, FLOWS.BROWSE),
      browsePath: '',
      shopView: 'collections',
      products: [],
      lastQuery: '',
    },
  };
}

async function buildCollectionProductsReply(collectionId, state, isAr) {
  let rawProducts;
  let title;
  let moreHref;

  switch (collectionId) {
    case 'deals': {
      const res = await fetchTodaysDeals(6);
      rawProducts = res?.products || [];
      title = isAr ? 'عروض اليوم' : "Today's deals";
      moreHref = '/offers';
      break;
    }
    case 'best_sellers':
      rawProducts = await fetchBestSellers(6);
      title = isAr ? 'الأكثر مبيعاً' : 'Best sellers';
      moreHref = '/products?sort=best-selling';
      break;
    case 'new_arrivals':
      rawProducts = await fetchNewArrivals(6);
      title = isAr ? 'وصل حديثاً' : 'New arrivals';
      moreHref = '/products?section=new-arrivals&sort=newest';
      break;
    default:
      return buildShopNowReply(state, isAr);
  }

  const nextState = {
    ...state,
    flow: FLOWS.BROWSE,
    shopView: 'collection',
    browsePath: '',
    products: rawProducts,
    lastQuery: title,
  };

  if (!rawProducts.length) {
    return {
      messages: [
        msg('bot-collection-empty', 'bot', title, {
          layout: 'empty',
          subtitle: isAr ? 'لا توجد منتجات في هذه المجموعة حالياً' : 'No products in this collection right now',
          actions: [
            { id: 'browse_shop', label: isAr ? 'مجموعات أخرى' : 'Other collections', icon: 'browse', variant: 'primary' },
            { id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search' },
            ...navActions(isAr),
          ],
        }),
      ],
      state: nextState,
    };
  }

  return {
    messages: [
      msg('bot-collection-products', 'bot', '', {
        layout: 'products',
        sectionTitle: title,
        sectionSubtitle: isAr ? 'اضغط «أضف للسلة» للشراء السريع' : 'Tap add to cart for quick checkout',
        viewAllHref: moreHref,
        viewAllLabel: isAr ? 'عرض الكل' : 'View all',
        products: mapProductsForChat(rawProducts, isAr),
        actions: shopCompactActions(isAr),
      }),
    ],
    state: nextState,
  };
}

function buildBrowseCategoriesMessage({
  sectionTitle,
  sectionSubtitle,
  browseCategories = [],
  browseSlugPath = '',
  browseBreadcrumb = [],
  isAr,
}) {
  return msg(`bot-browse-${Date.now()}`, 'bot', '', {
    layout: 'category_browse',
    sectionTitle,
    sectionSubtitle,
    browseCategories,
    browseSlugPath,
    browseBreadcrumb,
    actions: [{ id: 'browse_shop', label: isAr ? 'المجموعات المقترحة' : 'Collections', icon: 'browse' }],
  });
}

function buildBrowseRootReply(state, isAr, categoryTree = [], categories = []) {
  const roots = (categoryTree || []).filter((c) => c.isActive !== false);
  return {
    messages: [
      buildBrowseCategoriesMessage({
        sectionTitle: isAr ? 'تصفح الأقسام' : 'Browse categories',
        sectionSubtitle: isAr ? 'اختر القسم المناسب لما تبحث عنه' : 'Pick the department you need',
        browseCategories: roots.map((c) => mapBrowseCategory(c, '', isAr, categories)),
        browseSlugPath: '',
        browseBreadcrumb: buildBrowseBreadcrumb('', categories, isAr),
        isAr,
      }),
    ],
    state: {
      ...pushFlow(state, FLOWS.BROWSE),
      browsePath: '',
      shopView: 'categories',
      products: [],
      lastQuery: '',
    },
  };
}

function mapProductsForChat(products, isAr) {
  return products.map((p) => ({
    id: p._id || p.id,
    slug: p.slug,
    name: productName(p, isAr),
    price: formatPrice(p.price),
    oldPrice: p.oldPrice || p.compareAtPrice ? formatPrice(p.oldPrice || p.compareAtPrice) : null,
    image: p.image || p.images?.[0],
    emoji: p.emoji,
    stock: stockMeta(p, isAr),
    canAdd: (() => { const s = getProductAvailableStock(p); return s == null || s > 0; })(),
  }));
}

async function buildBrowseAtPath(slugPath, state, isAr, categories = []) {
  const path = String(slugPath || '').replace(/^\/+|\/+$/g, '');
  if (!path) return buildBrowseRootReply(state, isAr, [], categories);

  const browse = await fetchCategoryBrowse(path);
  if (!browse?.category) {
    return {
      messages: [
        msg('bot-browse-err', 'bot', isAr ? 'لم أجد هذا القسم' : 'Category not found', {
          layout: 'empty',
          subtitle: isAr ? 'جرّب قسمًا آخر' : 'Try another department',
          actions: [
            { id: 'browse_shop', label: isAr ? 'المجموعات المقترحة' : 'Collections', icon: 'browse', variant: 'primary' },
            { id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search' },
          ],
        }),
      ],
      state,
    };
  }

  const catLabel = categoryLabel(browse.category, isAr);
  const breadcrumb = buildBrowseBreadcrumb(path, categories, isAr);

  if (!browse.isLeaf && browse.children?.length) {
    return {
      messages: [
        buildBrowseCategoriesMessage({
          sectionTitle: catLabel,
          sectionSubtitle: isAr ? 'اختر قسمًا فرعيًا' : 'Choose a subcategory',
          browseCategories: browse.children.map((c) => mapBrowseCategory(c, path, isAr, categories)),
          browseSlugPath: path,
          browseBreadcrumb: breadcrumb,
          isAr,
        }),
      ],
      state: { ...state, flow: FLOWS.BROWSE, browsePath: path, products: [], lastQuery: catLabel },
    };
  }

  const res = await fetchProductsByCategoryPath(path, { page: 1, limit: 6 });
  const rawProducts = (res.products || res.data || []).slice(0, 6);
  const nextState = { ...state, flow: FLOWS.BROWSE, browsePath: path, products: rawProducts, lastQuery: catLabel };

  if (!rawProducts.length) {
    return {
      messages: [
        msg('bot-browse-empty', 'bot', '', {
          layout: 'empty',
          sectionTitle: isAr ? `لا منتجات في «${catLabel}»` : `No products in «${catLabel}»`,
          sectionSubtitle: isAr ? 'جرّب قسمًا آخر أو ابحث بالاسم' : 'Try another category or search by name',
          actions: [
            { id: 'browse_shop', label: isAr ? 'المجموعات المقترحة' : 'Collections', icon: 'browse' },
            { id: 'open_category', label: isAr ? 'صفحة القسم' : 'Category page', icon: 'browse', href: `/category/${path}` },
          ],
        }),
      ],
      state: nextState,
    };
  }

  return {
    messages: [
      msg('bot-browse-products', 'bot', '', {
        layout: 'products',
        sectionTitle: catLabel,
        sectionSubtitle: isAr ? 'اختر منتجًا وأضفه للسلة' : 'Pick a product to add to cart',
        browseBreadcrumb: breadcrumb,
        viewAllHref: `/category/${path}`,
        viewAllLabel: isAr ? 'عرض الكل' : 'View all',
        products: mapProductsForChat(rawProducts, isAr),
        actions: shopCompactActions(isAr),
      }),
    ],
    state: nextState,
  };
}

async function buildBrowseBackReply(state, isAr, categoryTree, categories) {
  const segments = String(state.browsePath || '').split('/').filter(Boolean);
  segments.pop();
  const parentPath = segments.join('/');
  if (!parentPath) {
    return buildBrowseRootReply({ ...state, browsePath: '' }, isAr, categoryTree, categories);
  }
  return buildBrowseAtPath(parentPath, { ...state, browsePath: parentPath }, isAr, categories);
}

function getOrderStatusTone(status) {
  switch (normalizeOrderStatus(status)) {
    case 'delivered': return 'green';
    case 'out_for_delivery': return 'purple';
    case 'preparing':
    case 'confirmed': return 'blue';
    case 'delivery_failed':
    case 'cancelled': return 'red';
    default: return 'amber';
  }
}

function mapOrderForChat(order, isAr) {
  const statusNorm = normalizeOrderStatus(order.orderStatus || order.status);
  const items = order.items || [];
  const itemCount = items.length;
  return {
    id: order._id,
    number: formatOrderNumber(order.orderNumber),
    status: getOrderStatusLabel(statusNorm, isAr),
    statusKey: statusNorm,
    statusTone: getOrderStatusTone(statusNorm),
    statusEmoji: getOrderStatusMeta(statusNorm)?.emoji || '📦',
    total: formatPrice(order.total || order.grandTotal || 0),
    dateLabel: order.createdAt ? formatRelativeTime(order.createdAt, isAr) : '',
    itemCount,
    itemSummary: itemCount
      ? (isAr ? `${itemCount} ${itemCount === 1 ? 'منتج' : 'منتجات'}` : `${itemCount} item${itemCount === 1 ? '' : 's'}`)
      : '',
    canReorder: statusNorm === 'delivered' && itemCount > 0,
    canTrack: order.canTrack === true || statusNorm === 'out_for_delivery',
  };
}

function buildOrdersListMessage({ id, title, subtitle, orders, isAr, extraActions = [] }) {
  return msg(id, 'bot', title, {
    layout: 'orders',
    subtitle,
    orders: orders.map((o) => mapOrderForChat(o, isAr)),
    actions: [...extraActions, ...navActions(isAr, { showBack: false })],
  });
}

async function buildOrdersReply(state, isAr, isAuthenticated) {
  if (!isAuthenticated) {
    const reply = buildLoginReply(isAr);
    return { ...reply, state: pushFlow(state, FLOWS.ORDERS) };
  }

  const orders = await loadOrders();
  const nextState = { ...pushFlow(state, FLOWS.ORDERS), orders };

  if (!orders.length) {
    return {
      messages: [
        msg('bot-no-orders', 'bot', isAr ? 'لا توجد طلبات بعد' : 'No orders yet', {
          layout: 'empty',
          subtitle: isAr ? 'ابدأ التسوق وأضف منتجاتك للسلة' : 'Start shopping and add items to your cart',
          actions: [
            { id: 'browse_shop', label: isAr ? 'تسوق الآن' : 'Shop now', icon: 'browse', variant: 'primary' },
            { id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search' },
            ...navActions(isAr, { showBack: false }),
          ],
        }),
      ],
      state: nextState,
    };
  }

  return {
    messages: [
      buildOrdersListMessage({
        id: 'bot-orders',
        title: isAr ? 'طلباتك الأخيرة' : 'Your recent orders',
        subtitle: isAr ? `${orders.length} ${orders.length === 1 ? 'طلب' : 'طلبات'}` : `${orders.length} order${orders.length === 1 ? '' : 's'}`,
        orders,
        isAr,
        extraActions: [
          { id: 'browse_shop', label: isAr ? 'تسوق الآن' : 'Shop now', icon: 'browse' },
        ],
      }),
    ],
    state: nextState,
  };
}

function pushFlow(state, nextFlow) {
  return { ...state, stack: [...state.stack, state.flow], flow: nextFlow };
}

function popFlow(state) {
  const stack = [...state.stack];
  const prev = stack.pop() || FLOWS.MENU;
  return { ...state, stack, flow: prev };
}

async function smartSearchProducts(rawQuery, isAr) {
  const variants = expandSearchQueries(rawQuery, isAr);
  const seen = new Set();
  const merged = [];

  for (const q of variants) {
    const result = await fetchSearchSuggestions(q);
    for (const p of result?.products || []) {
      const id = String(p._id || p.id || p.slug);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push({ ...p, _searchScore: scoreProduct(p, rawQuery, isAr) });
    }
    if (merged.length >= 8) break;
  }

  if (merged.length < 4) {
    try {
      const res = await fetchProductsPaginated({ q: rawQuery.trim(), page: 1, limit: 8 });
      for (const p of res.data || []) {
        const id = String(p._id || p.id || p.slug);
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push({ ...p, _searchScore: scoreProduct(p, rawQuery, isAr) });
      }
    } catch {
      // ignore
    }
  }

  const ranked = merged
    .sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0))
    .slice(0, 6);

  trackSearchEvent({ query: rawQuery, resultCount: ranked.length, source: 'chat' }).catch(() => {});

  return ranked;
}

async function loadOrders() {
  const { data } = await orderService.getMyOrders();
  return (data?.orders || []).slice(0, 8);
}

function buildMenuReply(isAr, userName, { greetingLine = null } = {}) {
  const greeting = greetingLine || (isAr ? `مرحباً${userName ? ` ${userName}` : ''}! 👋` : `Hello${userName ? ` ${userName}` : ''}! 👋`);
  const subtitle = greetingLine
    ? null
    : (isAr
      ? 'اكتب ما تحتاجه في الأسفل، أو اختر خدمة:'
      : 'Type below what you need, or pick a service:');
  return {
    messages: [
      msg('bot-menu', 'bot', greeting, {
        layout: greetingLine ? 'text' : 'welcome',
        subtitle,
        actions: menuActions(isAr),
      }),
    ],
    state: { flow: FLOWS.MENU, stack: [], products: [], orders: [], selectedOrder: null, lastQuery: '' },
  };
}

function buildSmallTalkReply(isAr, userName, rawText) {
  const q = String(rawText || '').trim().toLowerCase();
  const isHowAreYou = /how\s*are\s*you|how\s*r\s*u|كيف\s*حال|كيفك|شلونك|اخبارك|ازيك|عامل\s*ايه/i.test(q);
  const isAffection = /بحبك|احبك|love\s*you/i.test(q);
  const isCompare = /قارن|compare/i.test(q);
  let text;
  if (isAffection) {
    text = isAr
      ? `أهلاً! 😊 أنا مساعد التسوق هنا — أساعدك في إيجاد المنتجات والطلبات.\n\nإيه اللي تحب نبحث عنه اليوم؟`
      : "Hey! 😊 I'm your store shopping assistant — I can help you find products and orders.\n\nWhat would you like to look for today?";
  } else if (isCompare) {
    text = isAr
      ? 'ممكن أعرض لك منتجات مشابهة لما تبحث عنه — اكتب اسم المنتج (مثل: حليب أو منظف) وأنا أوريك الخيارات المتاحة.'
      : 'I can show similar products when you search — type a product name (e.g. milk or detergent) and I\'ll list what we have.';
  } else if (isHowAreYou) {
    text = isAr
      ? `بخير، شكراً${userName ? ` ${userName}` : ''}! 😊 أنا هنا لمساعدتك في التسوق.\n\nما المنتج الذي تبحث عنه؟`
      : `I'm doing great, thanks${userName ? ` ${userName}` : ''}! 😊 I'm here to help you shop.\n\nWhat product are you looking for?`;
  } else {
    text = isAr
      ? `تشرفنا${userName ? ` ${userName}` : ''}! 😊 كيف أقدر أساعدك في التسوق اليوم؟`
      : `Nice to meet you${userName ? ` ${userName}` : ''}! 😊 How can I help you shop today?`;
  }
  return {
    messages: [
      msg('bot-small-talk', 'bot', text, {
        layout: 'text',
        actions: menuActions(isAr),
      }),
    ],
    state: { flow: FLOWS.MENU, stack: [], products: [], orders: [], selectedOrder: null, lastQuery: '' },
  };
}

function buildThanksReply(isAr) {
  return {
    messages: [
      msg('bot-thanks', 'bot', isAr ? 'العفو! 😊 هل تحتاج شيئاً آخر؟' : "You're welcome! 😊 Anything else I can help with?", {
        layout: 'text',
        actions: menuActions(isAr),
      }),
    ],
    state: { flow: FLOWS.MENU, stack: [], products: [], orders: [], selectedOrder: null, lastQuery: '' },
  };
}

function buildGoodbyeReply(isAr) {
  return {
    messages: [
      msg('bot-bye', 'bot', goodbyeText(isAr), {
        layout: 'farewell',
        actions: [{ id: 'menu', label: isAr ? 'العودة للقائمة' : 'Back to menu', icon: 'menu' }],
      }),
    ],
    state: { flow: FLOWS.GOODBYE, stack: [], products: [], orders: [], selectedOrder: null, lastQuery: '' },
  };
}

function buildLoginReply(isAr, reason) {
  const text = reason || (isAr
    ? 'يرجى تسجيل الدخول للوصول إلى طلباتك.'
    : 'Please sign in to access your orders.');
  return {
    messages: [
      msg('bot-login', 'bot', text, {
        actions: [
          { id: 'login', label: isAr ? 'تسجيل الدخول' : 'Sign in', icon: 'login', href: '/login' },
          ...navActions(isAr),
        ],
      }),
    ],
  };
}

function buildCartReply(cart, isAr) {
  const items = cart?.items || [];
  if (!items.length) {
    return {
      messages: [
        msg('bot-cart-empty', 'bot', isAr ? 'سلتك فارغة حالياً' : 'Your cart is empty', {
          layout: 'empty',
          subtitle: isAr ? 'ابحث عن منتج وأضفه للسلة' : 'Search for a product to get started',
          actions: [
            { id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search', variant: 'primary' },
            ...navActions(isAr, { showBack: false }),
          ],
        }),
      ],
    };
  }

  return {
    messages: [
      msg('bot-cart', 'bot', '', {
        layout: 'cart',
        sectionTitle: isAr ? 'سلتك' : 'Your cart',
        sectionSubtitle: isAr ? 'عدّل الكمية أو أكمل الشراء من هنا' : 'Edit quantities or complete checkout here',
        cartItems: items.slice(0, 6).map((item) => ({
          name: isAr ? (item.name || item.nameEn) : (item.nameEn || item.name),
          quantity: item.quantity,
          total: formatPrice((item.price || 0) * item.quantity),
          image: item.image,
          emoji: item.emoji,
        })),
        cartSubtotal: formatPrice(cart.subtotal || 0),
        cartMore: items.length > 6 ? items.length - 6 : 0,
        actions: [
          { id: 'checkout_ai', label: isAr ? 'إتمام الشراء' : 'Checkout', icon: 'checkout', variant: 'primary' },
          { id: 'search', label: isAr ? 'متابعة التسوق' : 'Keep shopping', icon: 'search' },
        ],
      }),
    ],
  };
}

function buildDeliveryReply(settings, isAr) {
  const rows = [];
  if (settings?.deliveryFee != null) {
    rows.push({ label: isAr ? 'رسوم التوصيل' : 'Delivery fee', value: formatPrice(settings.deliveryFee) });
  }
  if (settings?.freeDeliveryThreshold > 0) {
    rows.push({
      label: isAr ? 'توصيل مجاني' : 'Free delivery',
      value: isAr ? `فوق ${formatPrice(settings.freeDeliveryThreshold)}` : `Over ${formatPrice(settings.freeDeliveryThreshold)}`,
    });
  }
  if (settings?.deliveryLeadDays != null) {
    rows.push({
      label: isAr ? 'مدة التوصيل' : 'Lead time',
      value: isAr ? `~${settings.deliveryLeadDays} يوم` : `~${settings.deliveryLeadDays} day(s)`,
    });
  }

  return {
    messages: [
      msg('bot-delivery', 'bot', isAr ? 'معلومات التوصيل' : 'Delivery information', {
        layout: 'info',
        infoRows: rows.length ? rows : [{ label: isAr ? 'التوصيل' : 'Delivery', value: isAr ? 'متاح لمناطق الخدمة' : 'Available in service areas' }],
        actions: navActions(isAr, { showBack: false }),
      }),
    ],
  };
}

function buildHelpReply(settings, isAr) {
  const actions = menuActions(isAr);
  if (settings?.whatsappUrl) {
    actions.push({ id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', href: settings.whatsappUrl, external: true });
  }
  actions.push({ id: 'contact', label: isAr ? 'تواصل مع الدعم' : 'Contact support', icon: 'contact' });

  return {
    messages: [
      msg('bot-help-offer', 'bot', isAr ? 'أكيد، أنا هنا لمساعدتك!' : 'Of course — I\'m here to help!', {
        layout: 'text',
        subtitle: isAr
          ? 'أقدر أساعدك في البحث عن منتجات، التوصيل، طلباتك، أو التواصل مع فريق الدعم.'
          : 'I can help you find products, check delivery, view orders, or reach our support team.',
        actions,
      }),
    ],
  };
}

/** Shown when AI is enabled but the API call fails — never fall back to product search */
export function buildAssistantUnavailableReply(isAr, settings = null, reason = '', state = null) {
  const actions = [...menuActions(isAr)];
  if (settings?.whatsappUrl) {
    actions.unshift({
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'whatsapp',
      href: settings.whatsappUrl,
      external: true,
    });
  }

  const defaultSubtitle = isAr
    ? 'يمكنك استخدام القائمة أدناه أو التواصل مع فريق الدعم مباشرة.'
    : 'Use the menu below or contact our support team directly.';

  return {
    messages: [
      msg('bot-ai-unavailable', 'bot', isAr ? 'المساعد الذكي غير متاح حالياً' : 'Smart assistant is unavailable right now', {
        layout: 'empty',
        subtitle: reason || defaultSubtitle,
        actions,
      }),
    ],
    state: state || createInitialChatState(),
  };
}

function buildContactReply(settings, isAr) {
  const rows = buildContactInfoRows(settings, isAr);
  const quickActions = buildContactQuickActions(settings, isAr, { excludeTypes: ['chat'] });
  const humanAction = {
    id: 'contact_human',
    label: isAr ? 'تحدث مع فريق الدعم' : 'Talk to our support team',
    icon: 'contact',
    variant: quickActions.length ? undefined : 'primary',
  };

  return {
    messages: [
      msg('bot-contact', 'bot', '', {
        layout: 'info',
        sectionTitle: isAr ? 'تواصل معنا' : 'Contact us',
        sectionSubtitle: isAr
          ? 'فريق الدعم جاهز لمساعدتك — استخدم بيانات التواصل أدناه'
          : 'Our support team is here to help — use the contact details below',
        infoRows: rows.length
          ? rows
          : [{ label: isAr ? 'الدعم' : 'Support', value: isAr ? 'تواصل معنا من إعدادات المتجر' : 'Configure contact details in store settings' }],
        actions: [
          humanAction,
          ...quickActions,
          ...navActions(isAr, { showBack: false }),
        ],
      }),
    ],
  };
}

async function buildSearchReply(query, state, isAr) {
  const products = await smartSearchProducts(query, isAr);
  const nextState = { ...pushFlow(state, FLOWS.SEARCH), products, lastQuery: query };

  if (!products.length) {
    return {
      messages: [
        msg('bot-no-products', 'bot', isAr ? 'لم أجد نتائج' : 'No results found', {
          layout: 'empty',
          subtitle: isAr
            ? `لا يوجد منتج مطابق لـ "${query}". جرّب كلمة أقصر أو اختر اقتراحاً:`
            : `Nothing matched "${query}". Try a shorter word or pick a suggestion:`,
          actions: [
            { id: 'search', label: isAr ? 'بحث جديد' : 'New search', icon: 'search' },
            { id: 'browse', label: isAr ? 'تصفح الكل' : 'Browse all', icon: 'browse', href: '/products' },
            ...navActions(isAr),
          ],
        }),
      ],
      state: nextState,
    };
  }

  const inStock = products.filter((p) => {
    const s = getProductAvailableStock(p);
    return s == null || s > 0;
  }).length;

  return {
    messages: [
      msg('bot-products', 'bot', '', {
        layout: 'products',
        sectionTitle: isAr ? 'نتائج البحث' : 'Search results',
        sectionSubtitle: isAr
          ? `نتائج «${query}»${inStock < products.length ? ` · ${products.length - inStock} غير متوفر` : ''}`
          : `Results for «${query}»${inStock < products.length ? ` · ${products.length - inStock} out of stock` : ''}`,
        viewAllHref: `/search/results?q=${encodeURIComponent(query)}`,
        viewAllLabel: isAr ? 'عرض الكل' : 'View all',
        products: products.map((p) => ({
          id: p._id || p.id,
          slug: p.slug,
          name: productName(p, isAr),
          price: formatPrice(p.price),
          oldPrice: p.oldPrice || p.compareAtPrice ? formatPrice(p.oldPrice || p.compareAtPrice) : null,
          image: p.image,
          emoji: p.emoji,
          stock: stockMeta(p, isAr),
          canAdd: (() => { const s = getProductAvailableStock(p); return s == null || s > 0; })(),
        })),
        actions: [
          { id: 'search', label: isAr ? 'بحث آخر' : 'Search again', icon: 'search' },
        ],
      }),
    ],
    state: nextState,
  };
}

function buildOrderDetailReply(order, isAr) {
  const num = formatOrderNumber(order.orderNumber);
  const status = getOrderStatusLabel(order.orderStatus || order.status, isAr);
  const total = formatPrice(order.total || order.grandTotal || 0);
  const statusNorm = order.orderStatus || order.status;
  const canCancel = CANCELABLE.has(statusNorm);
  const canEdit = canCustomerEditOrder(order);

  const actions = [
    { id: `track:${order._id}`, label: isAr ? 'تتبع الطلب' : 'Track order', icon: 'track', href: `/orders/${order._id}?track=1` },
  ];
  if (canEdit) {
    actions.push({ id: `edit:${order._id}`, label: isAr ? 'تعديل الطلب' : 'Edit order', icon: 'edit', href: `/orders/${order._id}?edit=1` });
  }
  if (canCancel) {
    actions.push({ id: `cancel:${order._id}`, label: isAr ? 'إلغاء الطلب' : 'Cancel order', icon: 'cancel', href: `/orders/${order._id}` });
  }
  if (statusNorm === 'delivered' && (order.items || []).length > 0) {
    actions.unshift({ id: `reorder:${order._id}`, label: isAr ? 'إعادة الطلب' : 'Reorder', icon: 'cart', variant: 'primary' });
  }
  actions.push(...navActions(isAr));

  const notes = [];
  if (!canCancel && statusNorm !== 'cancelled') {
    notes.push(isAr ? 'لا يمكن إلغاء هذا الطلب حالياً' : 'This order cannot be cancelled right now');
  }
  if (!canEdit) notes.push(getOrderEditBlockReason(order, isAr));

  return {
    messages: [
      msg('bot-order-detail', 'bot', isAr ? `طلب #${num}` : `Order #${num}`, {
        layout: 'order',
        orderStatus: status,
        orderTotal: total,
        orderNotes: notes,
        actions,
      }),
    ],
    state: { flow: FLOWS.ORDER_DETAIL, selectedOrder: order },
  };
}

function findProduct(state, productId) {
  return (state.products || []).find((p) => String(p._id || p.id) === String(productId));
}

function findOrder(state, orderId) {
  return (state.orders || []).find((o) => String(o._id) === String(orderId));
}

function formatAddressLabel(address, _isAr) {
  if (!address) return '';
  return [address.street, address.building, address.area || address.city].filter(Boolean).join(' · ');
}

function deliveryMethodLabel(methodId, isAr) {
  const meta = DELIVERY_METHODS[methodId];
  if (meta) return isAr ? meta.labelAr : meta.labelEn;
  return methodId;
}

function computeChatDeliveryFee(deliveryMethod, cart, settings, location) {
  const subtotal = Number(cart?.subtotal) || 0;
  return resolveDeliveryFee({
    deliveryMethod: deliveryMethod || 'scheduled',
    subtotal,
    threshold: settings?.freeDeliveryThreshold ?? 0,
    freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(settings?.freeDeliveryMethods),
    scheduledFee: location?.scheduledFee ?? 29.99,
    expressFee: location?.expressFee ?? 49.99,
  });
}

function computeChatOrderTotal(cart, draft, settings, location) {
  const subtotal = Number(cart?.subtotal) || 0;
  const discount = Number(cart?.discountAmount) || 0;
  const fee = computeChatDeliveryFee(draft?.deliveryMethod, cart, settings, location);
  return Math.max(0, subtotal - discount + fee);
}

function resolveScheduledLeadMinutes(settings, location) {
  return resolveDeliveryLeadMinutes({
    deliveryMethod: 'scheduled',
    storeSettings: settings,
    zone: location,
  });
}

function buildDefaultScheduleDraft(location, settings) {
  const timeSlots = location?.timeSlots || [];
  const scheduledLeadMinutes = resolveScheduledLeadMinutes(settings, location);
  const now = new Date();
  const earliest = getEarliestBooking({ slots: timeSlots, minLeadMinutes: scheduledLeadMinutes });
  const scheduledDate = earliest?.date || defaultBookingDate(now, timeSlots, scheduledLeadMinutes);
  const slotsForDate = filterAvailableSlots(timeSlots, scheduledDate, now, scheduledLeadMinutes);
  const scheduledTime = slotsForDate[0]?._id || earliest?.slot?._id || '';

  return {
    scheduledDate,
    scheduledTime: scheduledTime ? String(scheduledTime) : '',
    recurringFrequency: 'weekly',
    recurringPreferredWeekday: now.getDay(),
    recurringPreferredDayOfMonth: Math.min(now.getDate(), 28),
  };
}

function formatChatScheduleLine(draft, location, settings, isAr) {
  const method = draft?.deliveryMethod || 'scheduled';
  if (method === 'express') {
    return isAr ? 'توصيل سريع — خلال ساعتين' : 'Express — within 2 hours';
  }

  const timeSlots = location?.timeSlots || [];
  const scheduledLeadMinutes = resolveScheduledLeadMinutes(settings, location);
  const slot = resolveSelectedSlot(
    timeSlots,
    draft.scheduledTime,
    draft.scheduledDate,
    new Date(),
    scheduledLeadMinutes,
  );
  const slotLabel = slot ? (isAr ? slot.labelAr : slot.labelEn) : '';

  if (method === 'recurring') {
    const summary = buildRecurringScheduleSummary({
      frequency: draft.recurringFrequency || 'weekly',
      preferredWeekday: draft.recurringPreferredWeekday,
      preferredDayOfMonth: draft.recurringPreferredDayOfMonth,
      timeSlotLabelAr: slot?.labelAr,
      timeSlotLabelEn: slot?.labelEn,
    }, isAr);
    const firstDate = draft.scheduledDate || computeFirstRecurringDeliveryDate({
      frequency: draft.recurringFrequency || 'weekly',
      preferredWeekday: draft.recurringPreferredWeekday,
      preferredDayOfMonth: draft.recurringPreferredDayOfMonth,
      slotFrom: slot?.from,
    }, new Date(), timeSlots, scheduledLeadMinutes);
    return firstDate
      ? `${summary}${isAr ? ` · أول توصيل ${firstDate}` : ` · first ${firstDate}`}`
      : summary;
  }

  const date = draft.scheduledDate || '';
  if (date && slotLabel) return `${date} · ${slotLabel}`;
  return date || slotLabel || (isAr ? 'موعد التوصيل' : 'Delivery time');
}

function isCheckoutScheduleComplete(draft) {
  if (!draft?.deliveryMethod) return false;
  if (draft.deliveryMethod === 'express') return true;
  if (!draft.scheduledDate || !draft.scheduledTime) return false;
  if (draft.deliveryMethod === 'recurring') {
    if (draft.recurringFrequency === 'monthly') {
      return Boolean(draft.recurringPreferredDayOfMonth) && Number(draft.recurringPreferredDayOfMonth) <= 28;
    }
    return draft.recurringPreferredWeekday != null && draft.recurringPreferredWeekday !== '';
  }
  return true;
}

function buildChatDeliveryMethodOptions(cart, settings, location, isAr) {
  const subtotal = Number(cart?.subtotal) || 0;
  const threshold = settings?.freeDeliveryThreshold ?? 0;
  const freeMethods = parseFreeDeliveryMethodsFromApi(settings?.freeDeliveryMethods);
  const scheduledFee = location?.scheduledFee ?? 29.99;
  const expressFee = location?.expressFee ?? 49.99;
  const timeSlots = location?.timeSlots || [];
  const scheduledLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'scheduled',
    storeSettings: settings,
    zone: location,
  });
  const expressLeadMinutes = resolveDeliveryLeadMinutes({
    deliveryMethod: 'express',
    storeSettings: settings,
    zone: location,
  });

  const formatFee = (methodId) => {
    const fee = resolveDeliveryFee({
      deliveryMethod: methodId,
      subtotal,
      threshold,
      freeDeliveryMethods: freeMethods,
      scheduledFee,
      expressFee,
    });
    return fee === 0 ? (isAr ? 'مجاني' : 'Free') : formatPrice(fee);
  };

  const options = [];
  const earliest = getEarliestBooking({
    slots: timeSlots,
    minLeadMinutes: scheduledLeadMinutes,
  });
  const slotLabel = earliest?.slot
    ? (isAr ? (earliest.slot.labelAr || earliest.slot.labelEn) : (earliest.slot.labelEn || earliest.slot.labelAr))
    : null;

  options.push({
    id: 'scheduled',
    label: isAr ? DELIVERY_METHODS.scheduled.labelAr : DELIVERY_METHODS.scheduled.labelEn,
    description: isAr ? DELIVERY_METHODS.scheduled.descAr : DELIVERY_METHODS.scheduled.descEn,
    eta: isAr ? DELIVERY_METHODS.scheduled.etaAr : DELIVERY_METHODS.scheduled.etaEn,
    slotHint: earliest
      ? (isAr
        ? `أقرب موعد: ${earliest.date}${slotLabel ? ` · ${slotLabel}` : ''} — اضغط لاختيار موعدك`
        : `Earliest: ${earliest.date}${slotLabel ? ` · ${slotLabel}` : ''} — tap to pick your slot`)
      : (isAr ? 'اضغط لاختيار اليوم والموعد' : 'Tap to choose day and time'),
    feeLabel: formatFee('scheduled'),
    available: (Boolean(earliest) || timeSlots.length === 0) && location?.scheduledAvailable !== false,
    unavailableNote: location?.scheduledAvailable === false
      ? (isAr ? 'التوصيل العادي غير متاح في منطقتك' : 'Standard delivery unavailable in your area')
      : (!earliest && timeSlots.length > 0
        ? (isAr ? 'لا توجد مواعيد حالياً' : 'No slots available')
        : undefined),
    icon: 'delivery',
  });

  if (location?.expressAvailable !== false) {
    const expressOpen = isExpressAvailableNow({
      slots: timeSlots,
      minLeadMinutes: expressLeadMinutes,
    });
    options.push({
      id: 'express',
      label: isAr ? DELIVERY_METHODS.express.labelAr : DELIVERY_METHODS.express.labelEn,
      description: isAr ? DELIVERY_METHODS.express.descAr : DELIVERY_METHODS.express.descEn,
      eta: isAr ? DELIVERY_METHODS.express.etaAr : DELIVERY_METHODS.express.etaEn,
      slotHint: expressOpen
        ? (isAr ? 'متاح الآن للطلبات العاجلة' : 'Available now for urgent orders')
        : (isAr ? 'غير متاح في هذا الوقت' : 'Not available at this time'),
      feeLabel: formatFee('express'),
      available: expressOpen,
      unavailableNote: !expressOpen
        ? (isAr ? 'جرّب التوصيل العادي أو أكمل لاحقاً' : 'Try standard delivery or check back later')
        : undefined,
      icon: 'express',
    });
  }

  if (location?.scheduledAvailable !== false) {
    options.push({
      id: 'recurring',
      label: isAr ? DELIVERY_METHODS.recurring.labelAr : DELIVERY_METHODS.recurring.labelEn,
      description: isAr ? DELIVERY_METHODS.recurring.descAr : DELIVERY_METHODS.recurring.descEn,
      eta: isAr ? DELIVERY_METHODS.recurring.etaAr : DELIVERY_METHODS.recurring.etaEn,
      slotHint: isAr ? 'اضغط لاختيار جدول التكرار والموعد' : 'Tap to set repeat schedule and time slot',
      feeLabel: formatFee('recurring'),
      available: Boolean(earliest) || timeSlots.length === 0,
      unavailableNote: !earliest && timeSlots.length > 0
        ? (isAr ? 'لا توجد مواعيد حالياً' : 'No slots available')
        : undefined,
      icon: 'recurring',
    });
  }

  return options;
}

function buildCheckoutDeliveryScheduleReply(state, isAr, user, cart, settings, location, draft) {
  const saved = (user?.addresses || []).find((item) => String(item._id) === String(draft.addressId));
  const defaults = buildDefaultScheduleDraft(location, settings);
  const mergedDraft = {
    ...defaults,
    ...(state.checkoutDraft || {}),
    ...draft,
  };

  return {
    messages: [
      msg('bot-checkout-schedule', 'bot', '', {
        layout: 'checkout_delivery_schedule',
        checkoutStep: 3,
        checkoutStepsTotal: CHECKOUT_STEPS_TOTAL,
        sectionTitle: isAr ? 'إتمام الطلب' : 'Complete your order',
        sectionSubtitle: draft.deliveryMethod === 'recurring'
          ? (isAr ? 'الخطوة ٣: اختر جدول التوصيل الدوري والموعد' : 'Step 3: Choose recurring schedule and time')
          : (isAr ? 'الخطوة ٣: اختر يوم وموعد التوصيل' : 'Step 3: Choose delivery day and time'),
        deliveryLine: saved ? formatAddressLabel(saved, isAr) : undefined,
        deliveryMethod: mergedDraft.deliveryMethod,
        deliveryMethodLine: deliveryMethodLabel(mergedDraft.deliveryMethod, isAr),
        scheduleDefaults: mergedDraft,
        scheduledLeadMinutes: resolveScheduledLeadMinutes(settings, location),
        actions: [
          { id: 'checkout_back_delivery', label: isAr ? 'تغيير طريقة التوصيل' : 'Change delivery method', icon: 'back' },
        ],
      }),
    ],
    state: {
      ...state,
      flow: FLOWS.CHECKOUT,
      checkoutDraft: mergedDraft,
    },
  };
}

function buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, addressId) {
  const saved = (user?.addresses || []).find((item) => String(item._id) === String(addressId));
  const methods = buildChatDeliveryMethodOptions(cart, settings, location, isAr);

  return {
    messages: [
      msg('bot-checkout-delivery', 'bot', '', {
        layout: 'checkout_delivery',
        checkoutStep: 2,
        checkoutStepsTotal: CHECKOUT_STEPS_TOTAL,
        sectionTitle: isAr ? 'إتمام الطلب' : 'Complete your order',
        sectionSubtitle: isAr
          ? 'الخطوة ٢: اختر طريقة التوصيل'
          : 'Step 2: Choose delivery method',
        deliveryLine: saved ? formatAddressLabel(saved, isAr) : undefined,
        deliveryMethods: methods,
        cartSubtotal: formatPrice(cart?.subtotal || 0),
        actions: [
          { id: 'checkout_back_address', label: isAr ? 'تغيير العنوان' : 'Change address', icon: 'back' },
        ],
      }),
    ],
    state: {
      ...state,
      flow: FLOWS.CHECKOUT,
      checkoutDraft: { ...(state.checkoutDraft || {}), addressId },
    },
  };
}

function buildCheckoutAddAddressReply(state, isAr, location) {
  return {
    messages: [
      msg('bot-add-addr', 'bot', isAr ? 'أضف عنوان التوصيل' : 'Add delivery address', {
        layout: 'address_form',
        subtitle: isAr
          ? 'املأ العنوان هنا وسأكمل طلبك داخل المحادثة'
          : 'Enter your address here — I\'ll finish your order in this chat',
        addressDefaults: {
          city: isAr ? (location?.cityAr || location?.cityEn || '') : (location?.cityEn || location?.cityAr || ''),
          governorate: isAr ? (location?.cityAr || location?.cityEn || '') : (location?.cityEn || location?.cityAr || ''),
          area: isAr ? (location?.areaAr || location?.areaEn || '') : (location?.areaEn || location?.areaAr || ''),
          deliveryZoneId: location?.id || null,
        },
        actions: [
          { id: 'checkout_ai', label: isAr ? 'لدي عنوان محفوظ' : 'I have a saved address', icon: 'back' },
          ...navActions(isAr, { showBack: false }),
        ],
      }),
    ],
    state: { ...pushFlow(state, FLOWS.CHECKOUT), checkoutDraft: { step: 'add_address' } },
  };
}

function buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location) {
  const items = cart?.items || [];
  if (!items.length) {
    return {
      messages: [
        msg('bot-checkout-empty', 'bot', isAr ? 'لا يمكن إتمام الطلب' : 'Cannot checkout', {
          layout: 'empty',
          subtitle: isAr ? 'سلتك فارغة — أضف منتجات أولاً' : 'Your cart is empty — add products first',
          actions: [
            { id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search', variant: 'primary' },
            ...navActions(isAr, { showBack: false }),
          ],
        }),
      ],
      state,
    };
  }

  if (!isAuthenticated) {
    const login = buildLoginReply(isAr, isAr
      ? 'سجّل الدخول لإتمام الطلب عبر المساعد الذكي'
      : 'Sign in to checkout with the AI assistant');
    const loginMsg = login.messages[0];
    loginMsg.actions = [
      { id: 'checkout_login', label: isAr ? 'تسجيل الدخول' : 'Sign in', icon: 'login', variant: 'primary' },
      ...navActions(isAr, { showBack: false }),
    ];
    return { ...login, state: pushFlow(state, FLOWS.CHECKOUT) };
  }

  const addresses = user?.addresses || [];
  if (!addresses.length) {
    return buildCheckoutAddAddressReply(state, isAr, location);
  }

  const mappedAddresses = addresses.slice(0, 5).map((addr) => ({
    id: addr._id,
    line: formatAddressLabel(addr, isAr) || (isAr ? 'عنوان' : 'Address'),
    label: addr.label,
    isDefault: Boolean(addr.isDefault),
  }));

  return {
    messages: [
      msg('bot-checkout-start', 'bot', '', {
        layout: 'checkout_addresses',
        checkoutStep: 1,
        checkoutStepsTotal: CHECKOUT_STEPS_TOTAL,
        sectionTitle: isAr ? 'إتمام الطلب' : 'Complete your order',
        sectionSubtitle: isAr
          ? 'الخطوة ١: اضغط «تأكيد العنوان والمتابعة» على العنوان المناسب'
          : 'Step 1: Tap «Confirm address & continue» on your delivery address',
        cartItems: items.slice(0, 4).map((item) => ({
          name: isAr ? (item.name || item.nameEn) : (item.nameEn || item.name),
          quantity: item.quantity,
          total: formatPrice((item.price || 0) * item.quantity),
          image: item.image,
          emoji: item.emoji,
        })),
        cartSubtotal: formatPrice(cart.subtotal || 0),
        cartMore: items.length > 4 ? items.length - 4 : 0,
        savedAddresses: mappedAddresses,
        actions: [
          { id: 'checkout_add_address', label: isAr ? 'عنوان جديد' : 'New address', icon: 'delivery' },
        ],
      }),
    ],
    state: { ...pushFlow(state, FLOWS.CHECKOUT), checkoutDraft: {} },
  };
}

function buildCheckoutPaymentReply(state, isAr, user, settings, cart, location, draft = {}) {
  const addressId = draft.addressId || state.checkoutDraft?.addressId;
  const deliveryMethod = draft.deliveryMethod || state.checkoutDraft?.deliveryMethod || 'scheduled';
  const saved = (user?.addresses || []).find((item) => String(item._id) === String(addressId));
  const paymentOptions = (settings?.paymentMethods || [])
    .filter((method) => method.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const methods = paymentOptions.length ? paymentOptions : [
    { id: 'cod', labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery' },
    { id: 'stripe', labelAr: 'دفع أونلاين', labelEn: 'Online payment' },
  ];

  const deliveryFee = computeChatDeliveryFee(deliveryMethod, cart, settings, location);
  const orderTotal = computeChatOrderTotal(cart, { deliveryMethod }, settings, location);

  return {
    messages: [
      msg('bot-checkout-payment', 'bot', '', {
        layout: 'checkout_payment',
        checkoutStep: 4,
        checkoutStepsTotal: CHECKOUT_STEPS_TOTAL,
        sectionTitle: isAr ? 'إتمام الطلب' : 'Complete your order',
        sectionSubtitle: isAr
          ? 'الخطوة ٤: اختر طريقة الدفع'
          : 'Step 4: Choose your payment method',
        deliveryLine: saved ? formatAddressLabel(saved, isAr) : undefined,
        deliveryMethodLine: deliveryMethodLabel(deliveryMethod, isAr),
        scheduleLine: formatChatScheduleLine({ ...draft, deliveryMethod }, location, settings, isAr),
        deliveryFeeLine: deliveryFee === 0 ? (isAr ? 'مجاني' : 'Free') : formatPrice(deliveryFee),
        orderTotalLine: formatPrice(orderTotal),
        paymentMethods: methods.map((method) => ({
          id: method.id,
          label: isAr ? method.labelAr : method.labelEn,
          description: isAr ? (method.descriptionAr || '') : (method.descriptionEn || ''),
        })),
        actions: [
          {
            id: deliveryMethod === 'express' ? 'checkout_back_delivery' : 'checkout_back_schedule',
            label: deliveryMethod === 'express'
              ? (isAr ? 'تغيير التوصيل' : 'Change delivery')
              : (isAr ? 'تغيير الموعد' : 'Change time'),
            icon: 'back',
          },
        ],
      }),
    ],
    state: {
      ...state,
      flow: FLOWS.CHECKOUT,
      checkoutDraft: { ...(state.checkoutDraft || {}), ...draft, addressId, deliveryMethod },
    },
  };
}

function buildCheckoutConfirmReply(state, isAr, user, cart, settings, location, draft) {
  const saved = (user?.addresses || []).find((item) => String(item._id) === String(draft.addressId));
  const paymentOptions = (settings?.paymentMethods || []).filter((m) => m.enabled !== false);
  const paymentMeta = paymentOptions.find((m) => m.id === draft.paymentMethod) || {
    labelAr: draft.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'دفع أونلاين',
    labelEn: draft.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online payment',
  };
  const deliveryMethod = draft.deliveryMethod || 'scheduled';
  const deliveryFee = computeChatDeliveryFee(deliveryMethod, cart, settings, location);
  const orderTotal = computeChatOrderTotal(cart, draft, settings, location);

  return {
    messages: [
      msg('bot-checkout-confirm', 'bot', '', {
        layout: 'checkout_confirm',
        checkoutStep: 5,
        checkoutStepsTotal: CHECKOUT_STEPS_TOTAL,
        sectionTitle: isAr ? 'إتمام الطلب' : 'Complete your order',
        sectionSubtitle: isAr
          ? 'الخطوة ٥: راجع التفاصيل ثم اضغط تأكيد وإتمام الطلب'
          : 'Step 5: Review details, then tap confirm to place your order',
        infoRows: [
          { label: isAr ? 'المنتجات' : 'Items', value: String(cart?.items?.length || 0) },
          { label: isAr ? 'التوصيل' : 'Delivery', value: deliveryMethodLabel(deliveryMethod, isAr) },
          { label: isAr ? 'الموعد' : 'Schedule', value: formatChatScheduleLine(draft, location, settings, isAr) },
          { label: isAr ? 'رسوم التوصيل' : 'Delivery fee', value: deliveryFee === 0 ? (isAr ? 'مجاني' : 'Free') : formatPrice(deliveryFee) },
          { label: isAr ? 'الإجمالي' : 'Total', value: formatPrice(orderTotal) },
          { label: isAr ? 'العنوان' : 'Address', value: formatAddressLabel(saved, isAr) },
          { label: isAr ? 'الدفع' : 'Payment', value: isAr ? paymentMeta.labelAr : paymentMeta.labelEn },
        ],
        actions: [
          { id: 'checkout_back_payment', label: isAr ? 'تغيير الدفع' : 'Change payment', icon: 'back' },
        ],
      }),
    ],
    state: {
      ...state,
      flow: FLOWS.CHECKOUT,
      checkoutDraft: draft,
    },
  };
}

export function getDefaultQuickSearches(isAr) {
  return POPULAR_SEARCHES.map((item) => ({
    id: `quick_search:${item.query}`,
    query: item.query,
    label: isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr),
  }));
}

let trendingCache = null;
let trendingCacheAt = 0;

export async function getChatQuickSearches(isAr) {
  const now = Date.now();
  if (trendingCache && now - trendingCacheAt < 5 * 60 * 1000) {
    return trendingCache.map((item) => ({
      id: `quick_search:${item.query || item.labelEn}`,
      query: item.query || (isAr ? item.labelAr : item.labelEn),
      label: isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr),
    }));
  }
  try {
    const trending = await fetchTrendingSearches(6);
    if (trending?.length) {
      trendingCache = trending;
      trendingCacheAt = now;
      return trending.map((item) => ({
        id: `quick_search:${item.query || item.labelEn}`,
        query: item.query || (isAr ? item.labelAr : item.labelEn),
        label: isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr),
      }));
    }
  } catch {
    // fallback
  }
  return getDefaultQuickSearches(isAr);
}

export async function processChatInput({
  text = '',
  actionId = '',
  state = createInitialChatState(),
  isAr = true,
  isAuthenticated = false,
  userName = '',
  settings = null,
  cart = null,
  categoryTree = [],
  categories = [],
  user = null,
  location = null,
  checkoutDraftPatch = null,
}) {
  const userMessages = [];
  if (text?.trim()) userMessages.push(msg(`user-${Date.now()}`, 'user', text.trim()));

  if (actionId.startsWith('quick_search:')) {
    const query = actionId.slice('quick_search:'.length);
    const result = await buildSearchReply(query, state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }

  if (actionId === 'menu') {
    const r = buildMenuReply(isAr, userName);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (actionId === 'goodbye') {
    const r = buildGoodbyeReply(isAr);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (actionId === 'back') {
    if (state.flow === FLOWS.BROWSE && state.browsePath) {
      const result = await buildBrowseBackReply(state, isAr, categoryTree, categories);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.BROWSE && !state.browsePath && state.shopView && state.shopView !== 'collections') {
      const result = buildShopNowReply(state, isAr);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT && state.checkoutDraft?.paymentMethod) {
      const result = buildCheckoutPaymentReply(state, isAr, user, settings, cart, location, state.checkoutDraft);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT && isCheckoutScheduleComplete(state.checkoutDraft)) {
      const draft = state.checkoutDraft || {};
      if (draft.deliveryMethod === 'express') {
        const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, draft.addressId);
        return { ...result, messages: [...userMessages, ...result.messages] };
      }
      const result = buildCheckoutDeliveryScheduleReply(state, isAr, user, cart, settings, location, draft);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT && state.checkoutDraft?.deliveryMethod) {
      const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, state.checkoutDraft.addressId);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT && state.checkoutDraft?.addressId) {
      const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT) {
      const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const prev = popFlow(state);
    return {
      messages: [
        ...userMessages,
        msg('bot-back', 'bot', isAr ? 'كيف أساعدك؟' : 'How can I help?', {
          actions: menuActions(isAr),
        }),
      ],
      state: { ...prev, flow: FLOWS.MENU },
    };
  }
  if (actionId === 'change_selection') {
    if (state.flow === FLOWS.BROWSE) {
      const result = buildShopNowReply(state, isAr);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.SEARCH) {
      return {
        messages: [
          ...userMessages,
          msg('bot-change-search', 'bot', isAr ? 'ماذا تبحث عنه؟' : 'What are you looking for?', {
            layout: 'search_prompt',
            subtitle: isAr
              ? 'اكتب اسم منتج آخر أو اختر اقتراحاً'
              : 'Type another product or pick a suggestion',
            actions: navActions(isAr, { showBack: false }),
          }),
        ],
        state: { ...state, products: [], lastQuery: '' },
      };
    }
    if (state.flow === FLOWS.ORDERS || state.flow === FLOWS.ORDER_DETAIL) {
      const result = await buildOrdersReply(state, isAr, isAuthenticated);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    if (state.flow === FLOWS.CHECKOUT) {
      const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const r = buildMenuReply(isAr, userName, {
      greetingLine: isAr
        ? 'اختر خدمة أخرى من القائمة:'
        : 'Pick another option from the menu:',
    });
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (actionId === 'start_over') {
    const r = buildMenuReply(isAr, userName);
    return {
      ...r,
      messages: [...userMessages, ...r.messages],
      state: createInitialChatState(),
    };
  }
  if (actionId === 'open_cart' || actionId === 'cart') {
    const result = buildCartReply(cart, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state: { ...state, ...(result.state || {}), flow: FLOWS.MENU } };
  }
  if (actionId === 'begin_checkout') {
    actionId = 'checkout_ai';
  }
  if (actionId === 'browse_shop') {
    const result = buildShopNowReply(state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'browse_categories') {
    const result = buildBrowseRootReply(state, isAr, categoryTree, categories);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId.startsWith('collection_pick:')) {
    const collectionId = actionId.slice('collection_pick:'.length);
    if (collectionId === 'categories') {
      const result = buildBrowseRootReply(state, isAr, categoryTree, categories);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const result = await buildCollectionProductsReply(collectionId, state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId.startsWith('browse_pick:')) {
    const slugPath = decodeURIComponent(actionId.slice('browse_pick:'.length));
    const result = await buildBrowseAtPath(slugPath, state, isAr, categories);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'search') {
    return {
      messages: [
        ...userMessages,
        msg('bot-ask-search', 'bot', isAr ? 'ماذا تبحث عنه؟' : 'What are you looking for?', {
          layout: 'search_prompt',
          subtitle: isAr
            ? 'اكتب اسم المنتج أو اختر اقتراحاً سريعاً'
            : 'Type a product name or tap a quick suggestion',
          actions: navActions(isAr, { showBack: false }),
        }),
      ],
      state: { ...pushFlow(state, FLOWS.SEARCH), lastQuery: '' },
    };
  }
  if (actionId === 'orders') {
    const result = await buildOrdersReply(state, isAr, isAuthenticated);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'delivery') {
    const result = buildDeliveryReply(settings, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }
  if (actionId === 'contact') {
    const result = buildContactReply(settings, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }

  if (actionId === 'checkout_ai') {
    const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_add_address') {
    const result = buildCheckoutAddAddressReply(state, isAr, location);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId.startsWith('checkout_addr:')) {
    const addressId = actionId.slice('checkout_addr:'.length);
    const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, addressId);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId.startsWith('checkout_deliver:')) {
    const deliveryMethod = actionId.slice('checkout_deliver:'.length);
    userMessages.push(msg(`user-deliver-${Date.now()}`, 'user', deliveryMethodLabel(deliveryMethod, isAr)));
    const draft = {
      ...(state.checkoutDraft || {}),
      addressId: state.checkoutDraft?.addressId,
      deliveryMethod,
    };
    const options = buildChatDeliveryMethodOptions(cart, settings, location, isAr);
    const selected = options.find((m) => m.id === deliveryMethod);
    if (!selected?.available) {
      return {
        messages: [
          ...userMessages,
          msg('bot-checkout-delivery-unavail', 'bot', isAr ? 'طريقة التوصيل غير متاحة' : 'Delivery method unavailable', {
            layout: 'empty',
            subtitle: selected?.unavailableNote || (isAr ? 'اختر طريقة أخرى' : 'Choose another option'),
            actions: [
              { id: 'checkout_back_delivery', label: isAr ? 'اختيار آخر' : 'Choose again', icon: 'delivery', variant: 'primary' },
            ],
          }),
        ],
        state,
      };
    }
    if (deliveryMethod === 'express') {
      const result = buildCheckoutPaymentReply(state, isAr, user, settings, cart, location, draft);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const result = buildCheckoutDeliveryScheduleReply(state, isAr, user, cart, settings, location, draft);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_schedule_confirm') {
    const draft = {
      ...(state.checkoutDraft || {}),
      ...(checkoutDraftPatch || {}),
    };
    if (!isCheckoutScheduleComplete(draft)) {
      return {
        messages: [
          ...userMessages,
          msg('bot-checkout-schedule-incomplete', 'bot', isAr ? 'يرجى اختيار موعد التوصيل' : 'Please choose a delivery time', {
            layout: 'empty',
            subtitle: isAr ? 'حدّد اليوم والفترة ثم اضغط متابعة' : 'Pick day and time slot, then continue',
            actions: [
              { id: 'checkout_back_schedule', label: isAr ? 'رجوع' : 'Back', icon: 'back', variant: 'primary' },
            ],
          }),
        ],
        state: { ...state, checkoutDraft: draft },
      };
    }
    const result = buildCheckoutPaymentReply(state, isAr, user, settings, cart, location, draft);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId.startsWith('checkout_pay:')) {
    const paymentMethod = actionId.slice('checkout_pay:'.length);
    const draft = {
      ...(state.checkoutDraft || {}),
      addressId: state.checkoutDraft?.addressId,
      deliveryMethod: state.checkoutDraft?.deliveryMethod,
      paymentMethod,
    };
    const result = buildCheckoutConfirmReply(state, isAr, user, cart, settings, location, draft);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_back_address') {
    const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_back_delivery') {
    const addressId = state.checkoutDraft?.addressId;
    if (!addressId) {
      const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, addressId);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_back_schedule') {
    const draft = state.checkoutDraft || {};
    if (draft.deliveryMethod === 'express') {
      const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, draft.addressId);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const result = buildCheckoutDeliveryScheduleReply(state, isAr, user, cart, settings, location, draft);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_back_payment') {
    const draft = state.checkoutDraft || {};
    if (draft.deliveryMethod === 'express') {
      const result = buildCheckoutDeliveryReply(state, isAr, user, cart, settings, location, draft.addressId);
      return { ...result, messages: [...userMessages, ...result.messages] };
    }
    const result = buildCheckoutDeliveryScheduleReply(state, isAr, user, cart, settings, location, draft);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (actionId === 'checkout_place') {
    const draft = state.checkoutDraft || {};
    if (!draft.addressId || !draft.deliveryMethod || !draft.paymentMethod || !isCheckoutScheduleComplete(draft)) {
      return {
        messages: [
          ...userMessages,
          msg('bot-checkout-incomplete', 'bot', isAr ? 'يرجى إكمال بيانات الطلب' : 'Please complete order details', {
            actions: [
              { id: 'checkout_ai', label: isAr ? 'إعادة المحاولة' : 'Try again', icon: 'checkout', variant: 'primary' },
              ...navActions(isAr),
            ],
          }),
        ],
        state,
      };
    }
    return {
      messages: userMessages,
      state: { ...state, checkoutDraft: draft },
      sideEffect: { type: 'place_order', checkoutDraft: draft },
    };
  }

  if (actionId.startsWith('add:')) {
    const productId = actionId.slice(4);
    const product = findProduct(state, productId);
    if (!product) {
      return {
        messages: [...userMessages, msg('bot-err', 'bot', isAr ? 'لم أجد المنتج.' : 'Product not found.', { actions: navActions(isAr) })],
        state,
      };
    }
    const stock = getProductAvailableStock(product);
    if (stock != null && stock <= 0) {
      return {
        messages: [
          ...userMessages,
          msg('bot-oos', 'bot', `"${productName(product, isAr)}"`, {
            layout: 'empty',
            subtitle: isAr ? 'غير متوفر حالياً — جرّب منتجاً آخر' : 'Out of stock — try another product',
            actions: [
              { id: 'search', label: isAr ? 'بحث آخر' : 'Search again', icon: 'search', variant: 'primary' },
              ...navActions(isAr),
            ],
          }),
        ],
        state,
      };
    }
    return {
      messages: userMessages,
      state,
      sideEffect: {
        type: 'add_to_cart',
        product,
        productName: productName(product, isAr),
      },
    };
  }

  if (actionId.startsWith('view:')) {
    const productId = actionId.slice(5);
    const product = findProduct(state, productId);
    const slug = product?.slug;
    return {
      messages: [
        ...userMessages,
        msg('bot-view', 'bot', slug ? (isAr ? 'تفاصيل المنتج' : 'Product details') : (isAr ? 'لم أجد المنتج' : 'Product not found'), {
          actions: slug
            ? [{ id: 'go_product', label: isAr ? 'عرض الصفحة' : 'View page', icon: 'browse', href: `/products/${slug}` }, ...navActions(isAr)]
            : navActions(isAr),
        }),
      ],
      state,
    };
  }

  if (actionId.startsWith('reorder:')) {
    const orderId = actionId.slice('reorder:'.length);
    let order = findOrder(state, orderId);
    if (!order && isAuthenticated) {
      try {
        const { data } = await orderService.getById(orderId);
        order = data?.order;
      } catch { order = null; }
    }
    if (!order?.items?.length) {
      return {
        messages: [
          ...userMessages,
          msg('bot-reorder-err', 'bot', isAr ? 'تعذّر إعادة هذا الطلب' : 'Could not reorder this order', {
            actions: navActions(isAr),
          }),
        ],
        state,
      };
    }
    const num = formatOrderNumber(order.orderNumber);
    return {
      messages: [
        ...userMessages,
        msg('bot-reordered', 'bot', isAr ? `تمت إضافة طلب #${num} للسلة` : `Order #${num} added to cart`, {
          layout: 'success',
          subtitle: isAr
            ? `${order.items.length} منتج — راجع سلتك قبل الدفع`
            : `${order.items.length} item(s) — review your cart before checkout`,
          actions: [
            { id: 'open_cart', label: isAr ? 'عرض السلة' : 'View cart', icon: 'cart' },
            { id: 'begin_checkout', label: isAr ? 'إتمام الشراء' : 'Checkout', icon: 'checkout', variant: 'primary' },
            ...navActions(isAr, { showBack: false }),
          ],
        }),
      ],
      state: { ...state, orders: state.orders?.length ? state.orders : [order] },
      sideEffect: { type: 'reorder', order },
    };
  }

  if (actionId.startsWith('order:')) {
    const orderId = actionId.split(':')[1];
    let order = findOrder(state, orderId);
    if (!order && isAuthenticated) {
      try {
        const { data } = await orderService.getById(orderId);
        order = data?.order;
      } catch { order = null; }
    }
    if (!order) {
      return { messages: [...userMessages, msg('bot-order-err', 'bot', isAr ? 'لم أجد الطلب.' : 'Order not found.', { actions: navActions(isAr) })], state };
    }
    const result = buildOrderDetailReply(order, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state: { ...state, ...result.state, orders: state.orders?.length ? state.orders : [order] } };
  }

  if (actionId.startsWith('track:') || actionId.startsWith('edit:') || actionId.startsWith('cancel:') || actionId.startsWith('view_order:')) {
    const orderId = actionId.split(':')[1];
    let order = findOrder(state, orderId);
    if (!order && isAuthenticated) {
      try {
        const { data } = await orderService.getById(orderId);
        order = data?.order;
      } catch { order = null; }
    }
    if (!order) {
      return { messages: [...userMessages, msg('bot-order-err', 'bot', isAr ? 'لم أجد الطلب.' : 'Order not found.', { actions: navActions(isAr) })], state };
    }
    const result = buildOrderDetailReply(order, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state: { ...state, ...result.state, orders: state.orders?.length ? state.orders : [order] } };
  }

  const intent = detectIntent(text);
  const query = extractProductQuery(text, intent);

  if (intent === 'greeting') {
    const r = buildMenuReply(isAr, userName, {
      greetingLine: contextualGreetingText(isAr, userName, text),
    });
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (intent === 'small_talk') {
    const r = buildSmallTalkReply(isAr, userName, text);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (intent === 'thanks') {
    const r = buildThanksReply(isAr);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (intent === 'goodbye') {
    const r = buildGoodbyeReply(isAr);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (intent === 'menu' || intent === 'back') {
    const r = buildMenuReply(isAr, userName);
    return { ...r, messages: [...userMessages, ...r.messages] };
  }
  if (intent === 'cart') {
    const result = buildCartReply(cart, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }
  if (intent === 'checkout') {
    const result = buildCheckoutStartReply(state, isAr, isAuthenticated, cart, user, location);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (intent === 'delivery') {
    const result = buildDeliveryReply(settings, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }
  if (intent === 'help') {
    const result = buildHelpReply(settings, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }
  if (intent === 'contact') {
    const result = buildContactReply(settings, isAr);
    return { ...result, messages: [...userMessages, ...result.messages], state };
  }
  if (intent === 'shop') {
    const result = buildShopNowReply(state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }
  if (intent === 'orders' || intent === 'track' || intent === 'cancel' || intent === 'edit') {
    const result = await buildOrdersReply(state, isAr, isAuthenticated);
    if (result.messages[0] && intent !== 'orders') {
      result.messages[0].subtitle = intent === 'cancel'
        ? (isAr ? 'اختر الطلب الذي تريد إلغاءه' : 'Pick the order to cancel')
        : intent === 'edit'
          ? (isAr ? 'اختر الطلب الذي تريد تعديله' : 'Pick the order to edit')
          : (isAr ? 'اختر الطلب للمتابعة' : 'Pick an order to track');
    }
    return { ...result, messages: [...userMessages, ...result.messages] };
  }

  if ((intent === 'buy' || intent === 'price' || intent === 'free_text') && query.length >= 2) {
    if (!isLikelyProductQuery(query)) {
      const menu = buildMenuReply(isAr, userName, {
        greetingLine: contextualGreetingText(isAr, userName, text),
      });
      return { ...menu, messages: [...userMessages, ...menu.messages] };
    }
    const result = await buildSearchReply(query, state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }

  if (state.flow === FLOWS.SEARCH && text?.trim()) {
    const searchQuery = extractProductQuery(text, 'free_text');
    if (!isLikelyProductQuery(searchQuery)) {
      return {
        messages: [
          ...userMessages,
          msg('bot-ask-search-hint', 'bot', isAr
            ? 'اكتب اسم المنتج الذي تبحث عنه — مثل "حليب" أو "منظف أرضيات".'
            : 'Type a product name — e.g. "milk" or "floor cleaner".', {
            actions: navActions(isAr, { showBack: false }),
          }),
        ],
        state,
      };
    }
    const result = await buildSearchReply(searchQuery, state, isAr);
    return { ...result, messages: [...userMessages, ...result.messages] };
  }

  return {
    messages: [
      ...userMessages,
      msg('bot-help', 'bot', isAr ? 'كيف أساعدك؟' : 'How can I help?', {
        layout: 'empty',
        subtitle: isAr
          ? 'جرّب: "أريد حليب" أو "طلباتي" أو اختر من القائمة'
          : 'Try: "I need milk" or "my orders" or pick below',
        actions: menuActions(isAr),
      }),
    ],
    state,
  };
}

function extractProductQuery(text, intent) {
  let q = String(text || '').trim();
  if (!q) return '';
  const stripPrefixes = [
    /^(hi|hello|hey|good\s*(morning|evening|afternoon|night)[,!.\s]*)/i,
    /^(do\s+you\s+have|have\s+you\s+got|got\s+any|any\s+|show\s+me\s+|find\s+(me\s+)?)/i,
    /^(i\s+)?(want|need|would\s+like|like\s+to\s+buy|buy|get|search\s+for|looking\s+for)\s+(some\s+|a\s+|an\s+|the\s+)?/i,
    /^(can\s+i\s+get|could\s+i\s+get|can\s+you\s+get\s+me)\s+(some\s+|a\s+|an\s+|the\s+)?/i,
    /^(ابغى|ابي|عايز|أريد|محتاج|بدي|فين|فى?ن|عندكم|عندك|في|فيه|هل\s+عندكم|هل\s+عندك|ممكن|محتاج|اشتري|ابحث\s+عن|ابحث\s+لى?)\s*/i,
    /^(what\s+is\s+the\s+)?price\s+of\s+(the\s+)?/i,
    /^(how\s+much\s+is|how\s+much\s+for)\s+(the\s+)?/i,
    /^(كم\s+سعر|سعر|بكام|بكم|ب\s*ك\s*ا\s*م)\s*(ال?\s*)?/i,
  ];
  for (const re of stripPrefixes) q = q.replace(re, '').trim();
  q = q.replace(/[?!.,:;]+$/, '').trim();
  if (intent === 'price' || intent === 'buy' || intent === 'free_text') return q;
  return q;
}

function mapAssistantActions(actions = []) {
  return actions.map((action) => {
    const mapped = { ...action };
    if (action.id?.startsWith('add:')) mapped.icon = 'cart';
    else if (action.id?.startsWith('view:')) mapped.icon = 'browse';
    else if (action.id === 'search') mapped.icon = 'search';
    else if (action.id === 'menu') mapped.icon = 'menu';
    else mapped.icon = mapped.icon || 'search';
    return mapped;
  });
}

/** Keep only a short intro when product cards will show the details */
function extractAssistantProductIntro(message, productCount, isAr) {
  const raw = String(message || '').trim();
  if (!productCount) return raw || (isAr ? 'كيف أساعدك؟' : 'How can I help?');

  const stripped = raw.replace(/\*\*/g, '').trim();
  const hasNumberedList = /\d+[.)]\s/.test(stripped);
  const priceMentions = (stripped.match(/\d+[.\d]*\s*(جنيه|EGP|ج\.م)/gi) || []).length;

  if (!hasNumberedList && priceMentions < 2 && stripped.length <= 120) {
    const sentences = stripped.split(/(?<=[.!?؟])\s+/).filter((s) => {
      const line = s.trim();
      if (!line) return false;
      if (/\d+[.\d]*\s*(جنيه|EGP|ج\.م)/i.test(line)) return false;
      return !/^\d+[.)]/.test(line);
    });
    if (sentences.length) {
      const intro = sentences.slice(0, 2).join(' ').trim();
      if (intro.length > 8) return intro;
    }
  }

  return isAr
    ? `لقيتلك ${productCount} منتج — شوف التفاصيل تحت.`
    : `Found ${productCount} product(s) — see details below.`;
}

/** Map backend AI response into chat widget messages + state */
export function mapAssistantReply({ data, state, isAr }) {
  const rawProducts = data?.products || [];
  const displayProducts = rawProducts.map((p) => ({
    id: p._id,
    slug: p.slug,
    name: productName(p, isAr),
    price: formatPrice(p.price),
    oldPrice: p.oldPrice ? formatPrice(p.oldPrice) : null,
    image: p.image,
    emoji: p.emoji,
    stock: p.inStock === false
      ? { label: isAr ? 'غير متوفر' : 'Out of stock', tone: 'out' }
      : p.stock != null && p.stock <= 5
        ? { label: isAr ? `${p.stock} متبقي` : `${p.stock} left`, tone: 'low' }
        : { label: isAr ? 'متوفر' : 'In stock', tone: 'ok' },
    canAdd: p.inStock !== false,
  }));

  const layout = displayProducts.length ? 'products' : 'ai_chat';
  const actions = mapAssistantActions(data?.actions || []);
  if (!actions.length && displayProducts.length) {
    actions.push(
      { id: 'search', label: isAr ? 'بحث آخر' : 'Search again', icon: 'search' },
      ...navActions(isAr, { showBack: false }),
    );
  }

  const allOffers = displayProducts.length > 0 && rawProducts.every((p) => p.isOffer);
  const introText = displayProducts.length
    ? ''
    : extractAssistantProductIntro(data?.message, 0, isAr);
  const inStock = displayProducts.filter((p) => p.stock?.tone !== 'out').length;

  return {
    messages: [
      msg(`bot-ai-${Date.now()}`, 'bot', introText, {
        layout,
        source: 'ai',
        sectionTitle: displayProducts.length
          ? (isAr
            ? (allOffers ? 'عروض متاحة' : 'منتجات مقترحة')
            : (allOffers ? 'Available offers' : 'Suggested products'))
          : undefined,
        sectionSubtitle: displayProducts.length
          ? (isAr
            ? `${displayProducts.length} منتج${inStock < displayProducts.length ? ` · ${displayProducts.length - inStock} غير متوفر` : ''} · اضغط «أضف للسلة» للشراء السريع`
            : `${displayProducts.length} product(s)${inStock < displayProducts.length ? ` · ${displayProducts.length - inStock} out of stock` : ''} · Tap add to cart for quick checkout`)
          : undefined,
        viewAllHref: allOffers ? '/offers' : undefined,
        viewAllLabel: allOffers ? (isAr ? 'عرض كل العروض' : 'View all offers') : undefined,
        products: displayProducts,
        actions,
      }),
    ],
    state: {
      ...(displayProducts.length ? pushFlow(state, FLOWS.SEARCH) : state),
      products: rawProducts,
      lastQuery: displayProducts.length ? (state.lastQuery || '') : '',
    },
  };
}

export function getWelcomeMessages(isAr, userName) {
  return buildMenuReply(isAr, userName).messages;
}
