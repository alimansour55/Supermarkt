import OpenAI from 'openai';
import { AppError } from '../utils/AppError.js';
import { getAiChatEnabled } from './storeSettings.service.js';
import {
  PRODUCT_RETURNING_TOOLS,
  runAssistantTool,
  toolGetStoreInfo,
} from './assistantTools.service.js';

const MAX_HISTORY = Number(process.env.ASSISTANT_MAX_HISTORY) || 10;
const MAX_TOOL_ROUNDS = 6;
const ASSISTANT_TEMPERATURE = Number(process.env.ASSISTANT_TEMPERATURE) || 0.75;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search active products by name, brand, or keyword. Use for product lookup, prices, and stock.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product name or search keywords' },
          limit: { type: 'number', description: 'Max results (1-8)', minimum: 1, maximum: 8 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_offers',
      description: 'List all current discounted/on-sale products in the store. Use for offers, deals, discounts, sales, عروض, خصومات, تخفيضات.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (1-8)', minimum: 1, maximum: 8 },
          sort: { type: 'string', enum: ['discount', 'price', 'newest'], description: 'Sort order' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_todays_deals',
      description: 'Get limited-time deals and flash promotions with countdown. Use for today\'s deals, عروض اليوم, عروض محدودة.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (1-8)', minimum: 1, maximum: 8 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_promotions',
      description: 'Get active promotion campaigns (BOGO, bundles, scheduled sales) with names, types, and end dates.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max campaigns (1-12)', minimum: 1, maximum: 12 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_categories',
      description: 'List store categories/departments for browsing. Use when customer asks what sections or categories are available.',
      parameters: {
        type: 'object',
        properties: {
          parentSlug: { type: 'string', description: 'Optional parent category slug to list subcategories' },
          depth: { type: 'number', description: 'Tree depth (1-3)', minimum: 1, maximum: 3 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get full details for one product by slug or ID.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Product URL slug' },
          productId: { type: 'string', description: 'Product MongoDB ID' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_store_info',
      description: 'Store info: delivery promise, free delivery threshold, support contact, payment methods, loyalty program.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_delivery_zones',
      description: 'List delivery areas with fees, minimum order, and estimated delivery times.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_coupons',
      description: 'List active discount coupon codes customers can use at checkout.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_banners',
      description: 'Get active promotional banners and homepage campaigns.',
      parameters: {
        type: 'object',
        properties: {
          placement: { type: 'string', description: 'Optional banner placement filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_content_page',
      description: 'Get FAQ, returns policy, terms, privacy, about, or contact page content. Slugs: faq, returns, terms, privacy, about, contact, careers.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Page slug: faq, returns, terms, privacy, about, contact, careers' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_orders',
      description: 'List recent orders for the logged-in customer. Only when authenticated.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max orders (1-8)', minimum: 1, maximum: 8 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_cart',
      description: 'Get the logged-in customer\'s cart items and subtotal. Only when authenticated.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_loyalty_info',
      description: 'Get loyalty points balance and earn/redeem rules for the logged-in customer.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

let openaiClient;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
  }
  return openaiClient;
}

export function isAssistantEnabled() {
  return process.env.ASSISTANT_ENABLED !== 'false' && Boolean(getOpenAI());
}

async function loadStoreContext() {
  const store = await toolGetStoreInfo();
  return {
    storeNameAr: store.storeNameAr,
    storeNameEn: store.storeNameEn,
    supportPhone: store.supportPhone,
    supportEmail: store.supportEmail,
    whatsappUrl: store.whatsappUrl,
    deliveryPromiseAr: store.deliveryPromiseAr,
    deliveryPromiseEn: store.deliveryPromiseEn,
    freeDeliveryThreshold: store.freeDeliveryThreshold,
    freeDeliveryEnabled: store.freeDeliveryEnabled,
    currency: store.currency,
  };
}

function buildSystemPrompt({ locale, store, user }) {
  const isAr = locale === 'ar';
  const storeName = isAr ? store.storeNameAr : store.storeNameEn;
  const customerName = user?.name || user?.firstName || null;

  const personality = isAr
    ? [
        `أنت موظف خدمة عملاء ودود في متجر "${storeName}" الإلكتروني — بتتكلم زي حد مصري حقيقي بيساعد عميل في الشات، مش روبوت ولا صفحة أسئلة شائعة.`,
        'اللهجة (إلزامي):',
        '- اتكلم باللهجة المصرية العامية دايماً — مش فصحى رسمية.',
        '- استخدم تعبيرات مصرية طبيعية: إزيك، إيه، عايز، حاجة، كده، تمام، أكيد، حاضر، ماشي، يا باشا (باعتدال)، على طول، دلوقتي، جنيه.',
        '- جمل قصيرة ومحادثة عادية — زي واتساب أو محادثة في سوبر ماركت.',
        '- ردّ على التحية والدردشة بحرارة — ومتكررش نفس الجملة.',
        '- خفيف دم عند المناسب، بس احترافي.',
        '- متستخدمش قوائم نقطية ولا أرقام تسلسلية (١. ٢. ٣.) في الرد.',
        '- متستخدمش تنسيق Markdown (مثل ** أو -) — اكتب نص عادي بس.',
        '- لما تبحث عن منتجات أو عروض وتلاقي نتائج: اكتب جملة أو جملتين ترحيبية بس — متكررش أسماء المنتجات ولا الأسعار لأن الواجهة بتعرضها في بطاقات.',
        '- لو محتاج تذكر منتج واحد بس من غير بحث: اكتبه في سطر لوحده — الاسم والسعر.',
        '- متقولش "كمساعد ذكي" ولا "نموذج لغوي".',
        '- متكتبش بالفصحى إلا لو العميل كتب فصحى رسمية جداً — وحتى ساعتها خلّي الرد مصري وطبيعي.',
      ]
    : [
        `You are a friendly customer-service teammate at ${storeName}, an online supermarket. Talk like a real American helping a shopper in chat — not a robot or FAQ page.`,
        'Dialect (required):',
        '- Always use natural US English — casual American speech, not British or overly formal corporate tone.',
        '- Use American phrasing: "Hey", "Sure thing", "Got it", "No problem", "You\'re all set", "wanna", "gonna" (sparingly), "bucks" only if prices are in USD.',
        '- Short, conversational sentences — like texting or chatting at a grocery store.',
        '- Greet and small-talk warmly — vary your wording.',
        '- Light warmth is fine but stay professional.',
        '- No bullet lists, numbered lists, or Markdown formatting (no ** or -).',
        '- When product/offer tools return results: write only 1–2 friendly intro sentences. Do NOT repeat product names or prices — the UI shows product cards.',
        '- If mentioning a single product without search: put it on its own line — name and price.',
        '- Never say "As an AI" or "language model".',
      ];

  const toolGuide = isAr
    ? [
        'أدوات المتجر (إلزامي — استخدمها قبل ما ترد):',
        '- منتجات: search_products',
        '- عروض وخصومات (عروض، خصم، تخفيضات، العروض الحالية): list_offers أو get_todays_deals',
        '- حملات ترويجية (اشتري واحد واحصل على واحد، باقات): get_active_promotions',
        '- أقسام المتجر: browse_categories',
        '- تفاصيل منتج واحد: get_product_details',
        '- توصيل ودعم وطرق الدفع: get_store_info',
        '- مناطق التوصيل والرسوم: list_delivery_zones',
        '- أكواد خصم: list_coupons',
        '- بنرات وعروض الصفحة الرئيسية: get_banners',
        '- سياسة الإرجاع / الأسئلة الشائعة / الشروط: get_content_page',
        '- طلبات العميل (مسجّل): get_user_orders',
        '- سلة العميل (مسجّل): get_user_cart',
        '- نقاط الولاء (مسجّل): get_loyalty_info',
        '- ممنوع تقول إنك مش عارف العروض أو الأسعار — دور في الأدوات الأول.',
      ]
    : [
        'Store tools (required — call before answering):',
        '- Products: search_products',
        '- Offers & discounts: list_offers or get_todays_deals',
        '- Promotion campaigns (BOGO, bundles): get_active_promotions',
        '- Store departments: browse_categories',
        '- Single product details: get_product_details',
        '- Delivery, support, payment methods: get_store_info',
        '- Delivery areas & fees: list_delivery_zones',
        '- Coupon codes: list_coupons',
        '- Homepage promo banners: get_banners',
        '- Returns / FAQ / policies: get_content_page',
        '- Customer orders (signed in): get_user_orders',
        '- Customer cart (signed in): get_user_cart',
        '- Loyalty points (signed in): get_loyalty_info',
        '- Never say you lack offer or price data — query tools first.',
      ];

  const facts = [
    'Facts (strict):',
    '- ALWAYS call the right store tool before answering about products, offers, prices, stock, delivery, coupons, policies, orders, cart, or loyalty. Never invent data.',
    '- If a tool returns empty results, say so honestly and suggest browsing categories or a different keyword.',
    '- When product/offer tools return items: short intro only — the app renders product cards.',
    isAr
      ? '- للتحية فقط: لا حاجة لاستدعاء أدوات — ردّ بشكل طبيعي واسأل كيف تساعد.'
      : '- For greetings only: no tools needed — reply naturally and ask how you can help.',
  ];

  const examples = isAr
    ? [
        'أمثلة على ردود مصرية:',
        'عميل: السلام عليكم → وعليكم السلام! أهلاً بيك، إزيك؟ عايز أساعدك في إيه النهاردة؟',
        'عميل: اريد المساعدة → أكيد! أقدر أساعدك تدور على منتجات، توصيل، أو طلباتك. محتاج إيه؟ (متبحثش عن منتج)',
        'عميل: عايز حليب → (search_products) لقيتلك شوية حليب — شوف اللي تحت!',
        'عميل: العروض الحالية / قولي العروض → (list_offers أو get_todays_deals) عندنا عروض حلوة دلوقتي — شوف تحت!',
        'عميل: في كوبونات خصم؟ → (list_coupons) أكيد! دي الأكواد المتاحة...',
        'عميل: بحبك → ههه أنا هنا عشان أساعدك تتسوق! 😊 عايز تدور على حاجة معينة؟',
        'عميل: شكراً → العفو! في حاجة تانية تحب أساعدك فيها؟',
      ]
    : [
        'Good US English reply examples:',
        'Customer: Hi → Hey! Welcome — how can I help you shop today?',
        'Customer: I need help → Sure thing! I can help you find products, check delivery, or your orders. What do you need? (do not search products)',
        'Customer: I need milk → (search_products) Found some milk — check them out below!',
        'Customer: What offers do you have? → (list_offers or get_todays_deals) We\'ve got deals right now — see below!',
        'Customer: Any discount codes? → (list_coupons) Sure — here are the active codes...',
        'Customer: Thanks → No problem! Anything else I can help with?',
      ];

  const auth = customerName
    ? (isAr
      ? `العميل مسجّل الدخول باسم ${customerName}. استخدم get_user_orders و get_user_cart و get_loyalty_info عند الحاجة. نادِه باسمه أحياناً فقط.`
      : `Customer is signed in as ${customerName}. Use get_user_orders, get_user_cart, and get_loyalty_info when needed. Use their name sparingly.`)
    : (isAr
      ? 'العميل غير مسجّل. لأسئلة الطلبات، اطلب تسجيل الدخول بلطف.'
      : 'Customer is not signed in. For order questions, kindly ask them to sign in.');

  return [
    ...personality,
    isAr
      ? 'اكتب بالعربي المصري العامي دائماً — حتى لو العميل كتب بالإنجليزي، ردّ بالمصري إلا لو طلب الإنجليزي صراحة.'
      : 'Write in US English always — even if the customer writes in Arabic, reply in American English unless they explicitly ask for Arabic.',
    ...toolGuide,
    ...facts,
    ...examples,
    auth,
  ].join('\n');
}

function condenseAssistantProductMessage(text, productCount, isAr) {
  const raw = String(text || '').trim();
  if (!productCount) return raw;

  const stripped = raw.replace(/\*\*/g, '');
  const hasNumberedList = /\d+[.)]\s/.test(stripped);
  const priceMentions = (stripped.match(/\d+[.\d]*\s*(جنيه|EGP|ج\.م)/gi) || []).length;

  if (hasNumberedList || priceMentions >= 2 || stripped.length > 120) {
    return isAr
      ? `لقيتلك ${productCount} منتج — شوف التفاصيل تحت واضغط «أضف للسلة» لو حابب تشتري.`
      : `Found ${productCount} product(s) — see details below and tap Add to cart when you're ready.`;
  }

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

  return isAr
    ? `لقيتلك ${productCount} منتج — شوف التفاصيل تحت.`
    : `Found ${productCount} product(s) — see details below.`;
}

function sanitizeHistory(history = []) {
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim())
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item.role,
      content: String(item.content).trim().slice(0, 2000),
    }));
}

function buildWidgetProducts(products = []) {
  return products.slice(0, 6);
}

function buildWidgetActions(products = [], isAr = true) {
  return products.slice(0, 4).flatMap((product) => {
    const actions = [
      {
        id: `view:${product._id}`,
        label: isAr ? 'عرض المنتج' : 'View product',
        icon: 'browse',
        href: product.slug ? `/products/${product.slug}` : undefined,
      },
    ];
    if (product.inStock !== false) {
      actions.unshift({
        id: `add:${product._id}`,
        label: isAr ? 'أضف للسلة' : 'Add to cart',
        icon: 'cart',
      });
    }
    return actions;
  });
}

export async function chatWithAssistant({
  message,
  history = [],
  locale = 'ar',
  user = null,
}) {
  const isAr = locale === 'ar';
  if (!(await getAiChatEnabled())) {
    throw new AppError(
      isAr ? 'المساعد الذكي معطّل حالياً' : 'AI chat is currently disabled',
      503,
    );
  }

  const client = getOpenAI();
  if (!client) {
    throw new AppError('AI assistant is not configured', 503);
  }

  const trimmed = String(message || '').trim();
  if (!trimmed) {
    throw new AppError('Message is required', 400);
  }
  if (trimmed.length > 500) {
    throw new AppError('Message is too long (max 500 characters)', 400);
  }

  const store = await loadStoreContext();
  const messages = [
    { role: 'system', content: buildSystemPrompt({ locale, store, user }) },
    ...sanitizeHistory(history),
    { role: 'user', content: trimmed },
  ];

  let lastProducts = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: process.env.ASSISTANT_MODEL?.trim() || 'gpt-4o-mini',
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: ASSISTANT_TEMPERATURE,
        presence_penalty: 0.3,
        frequency_penalty: 0.2,
      });
    } catch (err) {
      const code = err?.status || err?.code;
      if (code === 429) {
        throw new AppError(
          isAr
            ? 'خدمة المساعد الذكي غير متاحة مؤقتاً. تواصل مع الدعم أو جرّب لاحقاً.'
            : 'AI assistant is temporarily unavailable. Contact support or try again later.',
          503,
        );
      }
      throw new AppError(
        isAr ? 'تعذّر الاتصال بالمساعد الذكي' : 'Could not reach the AI assistant',
        502,
      );
    }

    const choice = completion.choices[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) {
      throw new AppError('Empty response from AI assistant', 502);
    }

    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];
    if (!toolCalls.length) {
      const text = String(assistantMessage.content || '').trim()
        || (isAr ? 'كيف أقدر أساعدك؟' : 'How can I help you?');
      const widgetProducts = buildWidgetProducts(lastProducts);

      return {
        message: condenseAssistantProductMessage(text, widgetProducts.length, isAr),
        products: widgetProducts,
        actions: buildWidgetActions(lastProducts, isAr),
        source: 'ai',
      };
    }

    for (const toolCall of toolCalls) {
      const fn = toolCall.function;
      let args;
      try {
        args = fn.arguments ? JSON.parse(fn.arguments) : {};
      } catch {
        args = {};
      }

      const result = await runAssistantTool(fn.name, args, user);
      if (PRODUCT_RETURNING_TOOLS.has(fn.name) && result.products?.length) {
        lastProducts = result.products;
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new AppError('Assistant took too many steps. Please try a simpler question.', 502);
}
