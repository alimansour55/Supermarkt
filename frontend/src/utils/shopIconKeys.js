/**
 * Line-icon names the homepage sections store instead of emoji.
 * Pure data (no React) so node tests and the admin picker can share it;
 * `components/ui/ShopIcon.jsx` maps each name to its drawn icon.
 */

export const SHOP_ICON_GROUPS = [
  {
    id: 'service',
    labelAr: 'توصيل وخدمة',
    labelEn: 'Delivery & service',
    icons: [
      ['truck', 'توصيل', 'Delivery'],
      ['fast', 'سريع', 'Fast'],
      ['clock', 'وقت', 'Time'],
      ['timer', 'عدّاد', 'Timer'],
      ['calendar', 'موعد', 'Date'],
      ['pin', 'موقع', 'Location'],
      ['repeat', 'تكرار', 'Repeat'],
      ['returns', 'استرجاع', 'Returns'],
      ['support', 'دعم', 'Support'],
      ['chat', 'محادثة', 'Chat'],
      ['phone', 'اتصال', 'Call'],
      ['mail', 'بريد', 'Email'],
      ['app', 'تطبيق', 'App'],
      ['store', 'متجر', 'Store'],
      ['branch', 'فرع', 'Branch'],
    ],
  },
  {
    id: 'trust',
    labelAr: 'ثقة وجودة',
    labelEn: 'Trust & quality',
    icons: [
      ['shield', 'حماية', 'Protected'],
      ['lock', 'دفع آمن', 'Secure'],
      ['check', 'مضمون', 'Checked'],
      ['badge', 'موثّق', 'Verified'],
      ['award', 'جائزة', 'Award'],
      ['thumbs', 'إعجاب', 'Liked'],
      ['smile', 'رضا', 'Happy'],
      ['heart', 'مفضلة', 'Favorite'],
      ['star', 'تقييم', 'Rating'],
      ['crown', 'مميز', 'Premium'],
    ],
  },
  {
    id: 'deals',
    labelAr: 'عروض ومكافآت',
    labelEn: 'Deals & rewards',
    icons: [
      ['tag', 'سعر', 'Price tag'],
      ['percent', 'خصم', 'Discount'],
      ['flame', 'ساخن', 'Hot'],
      ['gift', 'هدية', 'Gift'],
      ['coins', 'نقاط', 'Points'],
      ['cash', 'كاش', 'Cash'],
      ['card', 'بطاقة', 'Card'],
      ['wallet', 'محفظة', 'Wallet'],
      ['ticket', 'كوبون', 'Coupon'],
      ['gem', 'قيّم', 'Gem'],
      ['sparkles', 'جديد', 'New'],
      ['megaphone', 'إعلان', 'Announcement'],
      ['share', 'مشاركة', 'Share'],
      ['receipt', 'فاتورة', 'Receipt'],
    ],
  },
  {
    id: 'shopping',
    labelAr: 'تسوّق',
    labelEn: 'Shopping',
    icons: [
      ['cart', 'سلة', 'Cart'],
      ['bag', 'شنطة', 'Bag'],
      ['package', 'طرد', 'Parcel'],
      ['boxes', 'جملة', 'Bulk'],
      ['search', 'بحث', 'Search'],
      ['grid', 'أقسام', 'Categories'],
      ['user', 'حساب', 'Account'],
      ['users', 'عملاء', 'Customers'],
      ['bell', 'تنبيه', 'Alert'],
      ['help', 'سؤال', 'Question'],
      ['info', 'معلومة', 'Info'],
      ['idea', 'فكرة', 'Tip'],
      ['image', 'صورة', 'Image'],
      ['video', 'فيديو', 'Video'],
      ['home', 'منزل', 'Home'],
    ],
  },
  {
    id: 'food',
    labelAr: 'أطعمة',
    labelEn: 'Food',
    icons: [
      ['leaf', 'طازج', 'Fresh'],
      ['apple', 'فاكهة', 'Fruit'],
      ['carrot', 'خضار', 'Vegetables'],
      ['salad', 'سلطة', 'Salad'],
      ['milk', 'ألبان', 'Dairy'],
      ['egg', 'بيض', 'Eggs'],
      ['bread', 'مخبوزات', 'Bakery'],
      ['wheat', 'حبوب', 'Grains'],
      ['meat', 'لحوم', 'Meat'],
      ['chicken', 'دواجن', 'Poultry'],
      ['fish', 'أسماك', 'Fish'],
      ['frozen', 'مجمدات', 'Frozen'],
      ['coffee', 'قهوة وشاي', 'Coffee & tea'],
      ['drink', 'مشروبات', 'Drinks'],
      ['water', 'مياه', 'Water'],
      ['cake', 'حلويات', 'Sweets'],
      ['candy', 'سكاكر', 'Candy'],
      ['cookie', 'بسكويت', 'Biscuits'],
      ['icecream', 'آيس كريم', 'Ice cream'],
      ['pizza', 'وجبات', 'Meals'],
    ],
  },
  {
    id: 'home',
    labelAr: 'منزل ومناسبات',
    labelEn: 'Home & occasions',
    icons: [
      ['clean', 'تنظيف', 'Cleaning'],
      ['laundry', 'غسيل', 'Laundry'],
      ['baby', 'أطفال', 'Baby'],
      ['health', 'صحة', 'Health'],
      ['beauty', 'عناية', 'Care'],
      ['pet', 'حيوانات', 'Pets'],
      ['moon', 'رمضان', 'Ramadan'],
      ['sun', 'صيف', 'Summer'],
      ['party', 'احتفال', 'Party'],
      ['school', 'مدارس', 'School'],
    ],
  },
];

export const SHOP_ICON_NAMES = SHOP_ICON_GROUPS.flatMap((g) => g.icons.map(([name]) => name));

const NAME_SET = new Set(SHOP_ICON_NAMES);

/** Emoji saved by older versions of the builder → the closest line icon. */
export const EMOJI_TO_SHOP_ICON = {
  '🚚': 'truck', '🚛': 'truck', '🛵': 'truck', '⚡': 'fast', '⏱️': 'timer', '⏰': 'clock', '🕐': 'clock',
  '📅': 'calendar', '🗓️': 'calendar', '📍': 'pin', '🗺️': 'pin', '🔁': 'repeat', '🔄': 'repeat', '↩️': 'returns',
  '🎧': 'support', '💬': 'chat', '📞': 'phone', '☎️': 'phone', '✉️': 'mail', '📧': 'mail', '📱': 'app',
  '🏪': 'store', '🏬': 'branch', '🏢': 'branch',
  '🛡️': 'shield', '🔒': 'lock', '🔐': 'lock', '✅': 'check', '✔️': 'check', '✓': 'check', '🏅': 'award',
  '🏆': 'award', '🥇': 'award', '👍': 'thumbs', '😊': 'smile', '😀': 'smile', '❤️': 'heart', '💖': 'heart',
  '⭐': 'star', '🌟': 'star', '💫': 'star', '👑': 'crown',
  '🏷️': 'tag', '💯': 'percent', '🔥': 'flame', '🎁': 'gift', '🪙': 'coins', '💰': 'coins', '💵': 'cash',
  '💳': 'card', '👛': 'wallet', '🎟️': 'ticket', '🎫': 'ticket', '💎': 'gem', '✨': 'sparkles', '🆕': 'sparkles',
  '📢': 'megaphone', '📣': 'megaphone', '🧾': 'receipt', '🔗': 'share',
  '🛒': 'cart', '🛍️': 'bag', '📦': 'package', '🔍': 'search', '🔎': 'search', '📂': 'grid', '🗂️': 'grid',
  '📋': 'grid', '🧭': 'grid', '👤': 'user', '👥': 'users', '🔔': 'bell', '❓': 'help', 'ℹ️': 'info',
  '💡': 'idea', '🖼️': 'image', '🎨': 'image', '🎬': 'video', '▶️': 'video', '🏠': 'home', '🎯': 'megaphone',
  '👆': 'cart', '📌': 'pin', '📊': 'star', '📝': 'info', '📄': 'info', '🔀': 'grid',
  '🥬': 'leaf', '🌿': 'leaf', '🍎': 'apple', '🍌': 'apple', '🥕': 'carrot', '🥗': 'salad', '🥛': 'milk',
  '🧀': 'milk', '🥚': 'egg', '🍞': 'bread', '🥐': 'bread', '🌾': 'wheat', '🍚': 'wheat', '🥩': 'meat',
  '🍗': 'chicken', '🐟': 'fish', '🧊': 'frozen', '❄️': 'frozen', '☕': 'coffee', '🍵': 'coffee', '🥤': 'drink',
  '🧃': 'drink', '💧': 'water', '🍰': 'cake', '🎂': 'cake', '🍬': 'candy', '🍫': 'candy', '🍪': 'cookie',
  '🍦': 'icecream', '🍕': 'pizza', '🍔': 'pizza',
  '🧴': 'clean', '🧼': 'clean', '🧽': 'clean', '🧺': 'laundry', '👶': 'baby', '🍼': 'baby', '💊': 'health',
  '💄': 'beauty', '🐶': 'pet', '🐱': 'pet', '🌙': 'moon', '☀️': 'sun', '🎉': 'party', '🎈': 'party', '🎒': 'school',
  // Catalog emoji (product placeholders and category icons from seed data).
  '🍊': 'apple', '🍇': 'apple', '🍓': 'apple', '🍉': 'apple', '🍋': 'apple', '🍑': 'apple', '🍐': 'apple',
  '🍒': 'apple', '🥭': 'apple', '🍍': 'apple', '🥝': 'apple', '🥥': 'apple',
  '🥔': 'carrot', '🧅': 'carrot', '🧄': 'carrot', '🥒': 'carrot', '🥦': 'carrot', '🌽': 'carrot', '🍅': 'carrot',
  '🫑': 'carrot', '🌶️': 'carrot', '🍆': 'carrot', '🧈': 'milk', '🍝': 'wheat', '🍜': 'wheat', '🥜': 'cookie',
  '🍯': 'candy', '🍟': 'pizza', '🌭': 'meat', '🥓': 'meat', '🦐': 'fish', '🥞': 'bread', '🧇': 'bread',
  '🍳': 'egg', '🍽️': 'pizza', '🥫': 'package', '🧂': 'package', '🫙': 'package',
  '🧹': 'clean', '🫧': 'clean', '🪣': 'clean', '🪟': 'clean', '🚿': 'clean', '🚽': 'clean', '🗑️': 'clean',
  '🦟': 'clean', '🧻': 'clean', '🪥': 'beauty', '🦷': 'beauty', '💇': 'beauty', '💆': 'beauty', '🌸': 'beauty',
  '🌺': 'beauty', '🩸': 'health', '🩹': 'health', '🧸': 'baby', '🚗': 'truck',
};

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

export function isShopIconName(value) {
  return NAME_SET.has(String(value || '').trim());
}

/** True for anything that looks like an emoji (what the old builder stored). */
export function looksLikeEmoji(value) {
  const v = String(value || '').trim();
  return v !== '' && (PICTOGRAPHIC.test(v) || Object.prototype.hasOwnProperty.call(EMOJI_TO_SHOP_ICON, v));
}

/**
 * The icon name to draw for a stored value: an icon name as-is, an old emoji
 * mapped to its closest icon, otherwise `fallback` (or '' for "draw nothing").
 */
export function resolveShopIcon(value, fallback = '') {
  const v = String(value || '').trim();
  if (!v) return fallback;
  if (NAME_SET.has(v)) return v;
  const mapped = EMOJI_TO_SHOP_ICON[v] || EMOJI_TO_SHOP_ICON[v.replace(/️/g, '')]
    || EMOJI_TO_SHOP_ICON[`${v.replace(/️/g, '')}️`];
  if (mapped) return mapped;
  return fallback;
}

/** Generic "shopping" defaults saved on products (e.g. the old '🛍️' form default). */
const GENERIC_PRODUCT_ICONS = new Set(['bag', 'cart', 'package']);

/**
 * Icon for a product with no photo: its saved emoji's closest food/home icon
 * when there is one, otherwise a neutral parcel.
 */
export function productPlaceholderIcon(emoji) {
  const name = resolveShopIcon(emoji);
  return name && !GENERIC_PRODUCT_ICONS.has(name) ? name : 'package';
}
