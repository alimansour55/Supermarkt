/** Homepage CMS — section types, categories, presets, field visibility. */

import { productSectionLayout as resolveProductSectionLayout } from '../../utils/dealSectionShared';

export const HOMEPAGE_SECTION_CATEGORIES = [
  {
    id: 'banners',
    labelAr: 'بانرات وعروض',
    labelEn: 'Banners & promos',
    types: [
      {
        value: 'hero_slider',
        labelAr: 'سلايدر رئيسي',
        labelEn: 'Hero slider',
        descriptionAr: 'اختر الشرائح يدوياً — صور، نصوص، ترتيب، واستيراد بانرات محددة.',
        descriptionEn: 'Curate slides manually — upload images, edit copy, reorder, import specific banners.',
        icon: '🖼️',
        fields: { link: false, category: false, products: false, items: false, campaign: false, hero: true, seo: false, layout: false, cta: false },
        defaults: { heroMode: 'curated', heroSlides: [], heroAutoplaySeconds: 6, sortOrder: 10 },
      },
      {
        value: 'promo_grid',
        labelAr: 'عروض وبانرات',
        labelEn: 'Promo & banners',
        descriptionAr: 'شبكة أو شريط أفقي — يدوي، جدولة، أو تلقائي من الحملات (Promo / Sidebar).',
        descriptionEn: 'Grid or horizontal strip — manual, scheduled, or auto from campaigns (promo / sidebar).',
        icon: '🎯',
        fields: { link: true, category: false, products: false, items: false, campaign: false, hero: true, seo: false, layout: true, cta: false },
        defaults: {
          campaignPlacement: 'promo',
          heroMode: 'auto',
          heroSlides: [],
          gridColumns: 3,
          layout: 'grid',
          link: '',
        },
      },
      {
        value: 'image_strip',
        labelAr: 'شريط صور (قديم)',
        labelEn: 'Image strip (legacy)',
        descriptionAr: 'مدمج في «عروض وبانرات» — للأقسام القديمة فقط.',
        descriptionEn: 'Merged into Promo & banners — legacy sections only.',
        icon: '🎨',
        hidden: true,
        fields: { link: true, category: false, products: false, items: false, campaign: false, hero: true, seo: false, layout: true, cta: false },
        defaults: {
          campaignPlacement: 'promo',
          heroMode: 'auto',
          heroSlides: [],
          gridColumns: 4,
          layout: 'scroll',
          link: '',
        },
      },
      {
        value: 'sidebar_banners',
        labelAr: 'بانرات جانبية (قديم)',
        labelEn: 'Sidebar banners (legacy)',
        descriptionAr: 'مدمج في «عروض وبانرات» — اختر موضع Sidebar + تلقائي.',
        descriptionEn: 'Merged into Promo & banners — use Sidebar placement + auto mode.',
        icon: '📌',
        hidden: true,
        fields: { link: false, category: false, products: false, items: false, campaign: true, hero: true, seo: false, layout: true, cta: false },
        defaults: {
          campaignPlacement: 'sidebar',
          titleAr: 'عروض مختارة',
          titleEn: 'Featured promos',
          heroMode: 'auto',
          heroSlides: [],
          layout: 'scroll',
          gridColumns: 4,
        },
      },
      {
        value: 'announcement_strip',
        labelAr: 'شريط إعلان',
        labelEn: 'Announcement bar',
        descriptionAr: 'رسالة قصيرة بارزة — توصيل مجاني، عروض سريعة، تنبيهات (أنماط متعددة).',
        descriptionEn: 'Short highlighted bar — free delivery, flash offers, alerts (multiple styles).',
        icon: '📢',
        fields: { link: false, category: false, products: false, items: false, campaign: false, hero: false, announcement: true, seo: false, layout: false, cta: false },
        defaults: {
          titleAr: 'توصيل مجاني للطلبات فوق 500 ج.م',
          titleEn: 'Free delivery on orders over EGP 500',
          subtitleAr: '',
          subtitleEn: '',
          ctaLabelAr: 'تسوق الآن',
          ctaLabelEn: 'Shop now',
          link: '/products',
          layout: 'accent',
          icon: '🚚',
          items: [],
          announcementConfig: {
            isEnabled: true,
            startDate: '',
            endDate: '',
            runsForever: true,
            mode: 'single',
            rotateSeconds: 6,
            dismissible: false,
            sticky: false,
          },
        },
      },
      {
        value: 'split_promo',
        labelAr: 'بطاقات ترويج مخصصة',
        labelEn: 'Custom promo cards',
        descriptionAr: 'بطاقات مصممة يدوياً — 2–4 أعمدة، أنماط وألوان (بدون مكتبة البانرات).',
        descriptionEn: 'Hand-designed cards — 2–4 columns, styles & colors (not from banner library).',
        icon: '⚌',
        fields: { link: false, category: false, products: false, items: false, campaign: false, hero: false, announcement: false, splitPromo: true, seo: false, layout: false, cta: false },
        defaults: {
          titleAr: '',
          titleEn: '',
          items: [
            { titleAr: 'عروض البقالة', titleEn: 'Grocery deals', subtitleAr: 'خصومات يومية', subtitleEn: 'Daily savings', emoji: '🛒', link: '/offers', accent: 'primary', ctaAr: 'تسوق الآن', ctaEn: 'Shop now' },
            { titleAr: 'منتجات التنظيف', titleEn: 'Cleaning essentials', subtitleAr: 'أفضل الأسعار', subtitleEn: 'Best prices', emoji: '✨', link: '/products', accent: 'emerald', ctaAr: 'اكتشف', ctaEn: 'Discover' },
          ],
          splitPromoConfig: {
            columns: 2,
            layout: 'balanced',
            cardStyle: 'overlay',
            tileHeight: 'medium',
            gap: 'normal',
            showTitle: false,
          },
        },
      },
      {
        value: 'flash_strip',
        labelAr: 'شريط عرض سريع (قديم)',
        labelEn: 'Flash sale strip (legacy)',
        descriptionAr: 'مدمج في «شريط إعلان» — استخدم النمط «بارز» أو قالب العروض.',
        descriptionEn: 'Merged into Announcement bar — use Bold style or sale preset.',
        icon: '⚡',
        hidden: true,
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: false },
        defaults: {
          titleAr: '⚡ عرض سريع — لفترة محدودة!',
          titleEn: '⚡ Flash sale — limited time!',
          link: '/offers',
          layout: 'bold',
          icon: '⚡',
        },
      },
    ],
  },
  {
    id: 'browse',
    labelAr: 'تصفّح وأقسام',
    labelEn: 'Browse & categories',
    types: [
      {
        value: 'browse_hub',
        labelAr: 'كتلة التصفّح',
        labelEn: 'Browse block',
        descriptionAr: 'مرن — عمودين، كل المنتجات، الأقسام الفرعية، أو بانر CTA.',
        descriptionEn: 'Flexible — split hub, all products, subcategories, or CTA banner.',
        icon: '🧭',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false, browseHub: true },
        defaults: {
          titleAr: 'كل المنتجات',
          titleEn: 'All products',
          subtitleAr: 'ماركات مفضّلة، عروض يومية، وأسعار واضحة',
          subtitleEn: 'Top brands, daily deals, clear prices',
          ctaLabelAr: 'تسوّق الآن',
          ctaLabelEn: 'Shop now',
          browseConfig: {
            variant: 'split',
            subcategoryCount: 7,
            showProducts: true,
            showSubcategories: true,
            productsLink: '/products',
            subcategoriesLink: '/subcategories',
          },
        },
      },
      {
        value: 'top_categories',
        labelAr: 'مركز التصفّح (قديم)',
        labelEn: 'Browse hub (legacy)',
        descriptionAr: 'نفس «مركز التصفّح» — للأقسام القديمة.',
        descriptionEn: 'Same as Browse hub — for legacy sections.',
        icon: '📂',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false },
        hidden: true,
      },
      {
        value: 'categories_scroll',
        labelAr: 'أقسام المتجر',
        labelEn: 'Store categories',
        descriptionAr: 'الأقسام الرئيسية — تمرير أفقي أو شبكة، من بيانات المتجر.',
        descriptionEn: 'Root departments — horizontal scroll or grid from live data.',
        icon: '🗂️',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false, categoryNav: true },
        defaults: {
          titleAr: 'تسوق حسب القسم',
          titleEn: 'Shop by category',
          categoryNavConfig: {
            layout: 'scroll',
            columns: 4,
            showTitle: true,
            showViewAll: true,
            viewAllLink: '/categories',
          },
        },
      },
      {
        value: 'subcategories_preview',
        labelAr: 'معاينة الأقسام الفرعية (قديم)',
        labelEn: 'Subcategories preview (legacy)',
        descriptionAr: '↪ مدمج في «كتلة التصفّح» — نمط بانر.',
        descriptionEn: '↪ Merged into Browse block — banner variant.',
        icon: '📋',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: true, browseHub: true },
        hidden: true,
        defaults: {
          titleAr: 'تصفّح الأقسام الفرعية',
          titleEn: 'Browse all subcategories',
          subtitleAr: 'كل العلامات والأنواع في مكان واحد',
          subtitleEn: 'All brands and types in one place',
          link: '/subcategories',
          icon: '📋',
        },
      },
      {
        value: 'brand_row',
        labelAr: 'صف العلامات',
        labelEn: 'Brand row',
        descriptionAr: 'علامات يدوية أو افتراضية — تمرير أو شبكة.',
        descriptionEn: 'Manual or default brands — scroll or grid layout.',
        icon: '🏷️',
        fields: { link: true, category: false, products: false, items: true, campaign: false, seo: false, layout: false, cta: false, brandRow: true },
        defaults: {
          titleAr: 'تسوق حسب العلامة',
          titleEn: 'Shop by brand',
          icon: '🏷️',
          link: '/brands',
          brandRowConfig: { layout: 'scroll', columns: 6, tileStyle: 'mixed' },
        },
      },
      {
        value: 'all_products_entry',
        labelAr: 'بطاقة كل المنتجات (قديم)',
        labelEn: 'All products card (legacy)',
        descriptionAr: '↪ مدمج في «كتلة التصفّح» — نمط كل المنتجات.',
        descriptionEn: '↪ Merged into Browse block — all products variant.',
        icon: '🛍️',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: true, browseHub: true },
        hidden: true,
        defaults: {
          titleAr: 'تصفّح كل المنتجات',
          titleEn: 'Browse all products',
          subtitleAr: 'فلترة حسب القسم، الماركة، السعر والمزيد',
          subtitleEn: 'Filter by category, brand, price, and more',
          link: '/products',
          icon: '🛍️',
          ctaLabelAr: 'عرض الكل',
          ctaLabelEn: 'Shop all',
        },
      },
    ],
  },
  {
    id: 'products',
    labelAr: 'منتجات',
    labelEn: 'Products',
    types: [
      {
        value: 'product_grid',
        labelAr: 'عرض المنتجات',
        labelEn: 'Product showcase',
        descriptionAr: 'مرن — شريط أفقي أو شبكة، فلاتر تلقائية أو منتجات يدوية، قوالب جاهزة.',
        descriptionEn: 'Flexible — scroll or grid, auto filters or hand-picked, quick presets.',
        icon: '📦',
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: false, cta: false, productShowcase: true },
        defaults: {
          layout: 'scroll',
          link: '/products',
          productQuery: { sort: 'best-selling', limit: 12 },
          productShowcaseConfig: { layout: 'scroll', columns: 4, showViewAll: true },
        },
      },
      {
        value: 'product_carousel',
        labelAr: 'منتجات متحركة (قديم)',
        labelEn: 'Product carousel (legacy)',
        descriptionAr: '↪ مدمج في «عرض المنتجات» — نمط شريط أفقي.',
        descriptionEn: '↪ Merged into Product showcase — use scroll layout.',
        icon: '⭐',
        hidden: true,
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: true, cta: false, productShowcase: true },
      },
      {
        value: 'top_rated',
        labelAr: 'الأعلى تقييماً (قديم)',
        labelEn: 'Top rated (legacy)',
        descriptionAr: '↪ مدمج في «عرض المنتجات» — قالب الأعلى تقييماً.',
        descriptionEn: '↪ Merged into Product showcase — use Top rated preset.',
        icon: '💫',
        hidden: true,
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: true, cta: false, productShowcase: true },
        defaults: {
          titleAr: 'الأعلى تقييماً',
          titleEn: 'Top rated',
          icon: '💫',
          link: '/products?sort=top',
          productQuery: { section: 'top', sort: 'top', limit: 12 },
        },
      },
      {
        value: 'daily_offers',
        labelAr: 'عروض مع عدّاد',
        labelEn: 'Deals & countdown',
        descriptionAr: 'تخفيضات + عدّاد — نمط يومي، عرض سريع، أو بسيط بدون عدّاد.',
        descriptionEn: 'Discounts + timer — daily, flash, or minimal without countdown.',
        icon: '🔥',
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: false, cta: false, dealShowcase: true },
        defaults: {
          titleAr: 'عروض اليوم',
          titleEn: 'Daily offers',
          subtitleAr: 'خصومات لفترة محدودة',
          subtitleEn: 'Limited-time deals',
          icon: '🔥',
          link: '/today-deals',
          productQuery: { sort: 'discount', limit: 12 },
          dealConfig: {
            style: 'standard',
            campaignMode: 'standalone',
            showCountdown: true,
            countdownMode: 'promotion',
            countdownDurationHours: 6,
            layout: 'scroll',
            columns: 4,
            showSubtitle: true,
            showViewAll: true,
          },
        },
      },
      {
        value: 'flash_sale',
        labelAr: 'تخفيضات سريعة (قديم)',
        labelEn: 'Flash sale (legacy)',
        descriptionAr: '↪ مدمج في «عروض مع عدّاد» — نمط عرض سريع.',
        descriptionEn: '↪ Merged into Deals & countdown — use Flash style.',
        icon: '⚡',
        hidden: true,
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: true, cta: false, dealShowcase: true },
        defaults: {
          titleAr: 'تخفيضات سريعة',
          titleEn: 'Flash sale',
          icon: '⚡',
          link: '/offers',
          productQuery: { offers: true, sort: 'discount', limit: 12 },
          dealConfig: { style: 'flash', showCountdown: true, layout: 'scroll', columns: 4 },
        },
      },
      {
        value: 'category_spotlight',
        labelAr: 'قسم مميز',
        labelEn: 'Category spotlight',
        descriptionAr: 'منتجات من قسم محدد — مثالي للماركات والتصنيفات.',
        descriptionEn: 'Products from one category — great for brands & departments.',
        icon: '💎',
        fields: { link: true, category: true, products: true, items: false, campaign: false, seo: false, layout: false, cta: false },
        defaults: { productQuery: { sort: 'best-selling', limit: 12 } },
      },
      {
        value: 'trending_searches',
        labelAr: 'الأكثر بحثاً',
        labelEn: 'Trending searches',
        descriptionAr: 'كلمات بحث شائعة + منتجات مقترحة.',
        descriptionEn: 'Popular search chips + suggested products.',
        icon: '🔍',
        fields: { link: true, category: false, products: true, items: false, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          titleAr: 'الأكثر بحثاً',
          titleEn: 'Trending searches',
          icon: '🔍',
          link: '/search/results',
          productQuery: { sort: 'best-selling', limit: 12 },
        },
      },
    ],
  },
  {
    id: 'social',
    labelAr: 'ثقة ومميزات',
    labelEn: 'Trust & features',
    types: [
      {
        value: 'trust_badges',
        labelAr: 'شارات الثقة',
        labelEn: 'Trust badges',
        descriptionAr: 'توصيل سريع، دفع آمن، استرجاع سهل — أيقونات.',
        descriptionEn: 'Fast delivery, secure pay, easy returns — icon row.',
        icon: '🛡️',
        fields: { link: false, category: false, products: false, items: true, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          items: [
            { titleAr: 'توصيل سريع', titleEn: 'Fast delivery', emoji: '🚚', link: '' },
            { titleAr: 'دفع آمن', titleEn: 'Secure payment', emoji: '🔒', link: '' },
            { titleAr: 'استرجاع سهل', titleEn: 'Easy returns', emoji: '↩️', link: '/returns' },
            { titleAr: 'جودة مضمونة', titleEn: 'Quality guaranteed', emoji: '✅', link: '' },
          ],
        },
      },
      {
        value: 'stats_bar',
        labelAr: 'شريط أرقام',
        labelEn: 'Stats bar',
        descriptionAr: 'أرقام مميزة — منتجات، عملاء، توصيل.',
        descriptionEn: 'Impressive numbers — products, customers, delivery.',
        icon: '📊',
        fields: { link: false, category: false, products: false, items: true, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          items: [
            { titleAr: 'منتج', titleEn: 'Products', emoji: '1000+', query: 'منتج متاح' },
            { titleAr: 'عميل سعيد', titleEn: 'Happy customers', emoji: '50K+', query: 'تقييمات ممتازة' },
            { titleAr: 'توصيل', titleEn: 'Delivery', emoji: '24h', query: 'في نفس اليوم' },
            { titleAr: 'أقسام', titleEn: 'Categories', emoji: '100+', query: 'تنوع واسع' },
          ],
        },
      },
      {
        value: 'feature_cards',
        labelAr: 'بطاقات مميزات',
        labelEn: 'Feature cards',
        descriptionAr: '3–6 بطاقات — لماذا تتسوق معنا؟',
        descriptionEn: '3–6 cards — why shop with us?',
        icon: '💡',
        fields: { link: false, category: false, products: false, items: true, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          titleAr: 'لماذا سوق+؟',
          titleEn: 'Why MarketPlus?',
          items: [
            { titleAr: 'أسعار تنافسية', titleEn: 'Competitive prices', emoji: '💰', query: 'عروض يومية', link: '/offers' },
            { titleAr: 'توصيل للباب', titleEn: 'Doorstep delivery', emoji: '🏠', query: 'تتبع طلبك', link: '/track-order' },
            { titleAr: 'نقاط ومكافآت', titleEn: 'Points & rewards', emoji: '🎁', query: 'استرداد نقدي', link: '/my-points' },
          ],
        },
      },
    ],
  },
  {
    id: 'utility',
    labelAr: 'أدوات وتوصيل',
    labelEn: 'Utility & delivery',
    types: [
      {
        value: 'free_delivery_banner',
        labelAr: 'شريط التوصيل المجاني',
        labelEn: 'Free delivery progress',
        descriptionAr: 'يعرض تقدم الوصول للتوصيل المجاني (حسب السلة).',
        descriptionEn: 'Cart-aware free delivery progress strip.',
        icon: '🚚',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false },
      },
      {
        value: 'delivery_area_bar',
        labelAr: 'منطقة التوصيل',
        labelEn: 'Delivery area picker',
        descriptionAr: '«التوصيل إلى: …» مع اختيار المنطقة.',
        descriptionEn: '“Delivering to: …” with area selector.',
        icon: '📍',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false },
      },
    ],
  },
  {
    id: 'cta',
    labelAr: 'دعوات للإجراء (CTA)',
    labelEn: 'Calls to action',
    types: [
      {
        value: 'cta_card',
        labelAr: 'بطاقة CTA',
        labelEn: 'CTA card',
        descriptionAr: 'بطاقة دعوة مخصصة — عنوان، وصف، رابط.',
        descriptionEn: 'Custom call-to-action card with title, text, link.',
        icon: '👆',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'تصفّح كل المنتجات',
          titleEn: 'Browse all products',
          subtitleAr: 'فلترة حسب القسم، الماركة، السعر والمزيد',
          subtitleEn: 'Filter by category, brand, price, and more',
          link: '/products',
          layout: 'horizontal',
          icon: '🛒',
        },
      },
      {
        value: 'loyalty_promo',
        labelAr: 'برنامج النقاط',
        labelEn: 'Loyalty / points promo',
        descriptionAr: 'ترويج لبرنامج الاسترداد النقدي والنقاط.',
        descriptionEn: 'Promote cashback and loyalty points program.',
        icon: '🎁',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'اكسب نقاطاً مع كل طلب',
          titleEn: 'Earn points on every order',
          subtitleAr: 'استرداد نقدي عند الدفع — سجّل وابدأ التجميع',
          subtitleEn: 'Cashback at checkout — sign up and start earning',
          link: '/my-points',
          layout: 'gradient',
          icon: '🎁',
        },
      },
      {
        value: 'recurring_promo',
        labelAr: 'التوصيل الدوري',
        labelEn: 'Recurring delivery',
        descriptionAr: 'اشترك ووفّر — توصيل تلقائي متكرر.',
        descriptionEn: 'Subscribe & save with recurring delivery.',
        icon: '🔁',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'التوصيل الدوري — وفر وقتك',
          titleEn: 'Recurring delivery — save time',
          subtitleAr: 'جدولة تلقائية لطلباتك الأسبوعية',
          subtitleEn: 'Automatic scheduling for your weekly essentials',
          link: '/recurring-deliveries',
          layout: 'gradient',
          icon: '🔁',
        },
      },
      {
        value: 'app_download',
        labelAr: 'تحميل التطبيق',
        labelEn: 'App download',
        descriptionAr: 'أزرار App Store / Google Play من إعدادات المتجر.',
        descriptionEn: 'App Store / Google Play badges from store settings.',
        icon: '📱',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          titleAr: 'حمّل تطبيقنا',
          titleEn: 'Download our app',
          subtitleAr: 'تسوّق أسرع من هاتفك',
          subtitleEn: 'Shop faster from your phone',
        },
      },
      {
        value: 'dual_cta',
        labelAr: 'زرّان جنباً إلى جنب',
        labelEn: 'Dual CTA buttons',
        descriptionAr: 'خياران بارزان — مثل العروض + المنتجات.',
        descriptionEn: 'Two prominent choices — e.g. offers + products.',
        icon: '🔀',
        fields: { link: false, category: false, products: false, items: true, campaign: false, seo: false, layout: false, cta: false },
        defaults: {
          items: [
            { titleAr: 'العروض', titleEn: 'Offers', emoji: '🔥', link: '/offers', query: 'خصومات اليوم' },
            { titleAr: 'كل المنتجات', titleEn: 'All products', emoji: '🛒', link: '/products', query: 'تصفّح المتجر' },
          ],
        },
      },
      {
        value: 'signup_promo',
        labelAr: 'التسجيل / حساب جديد',
        labelEn: 'Sign up promo',
        descriptionAr: 'دعوة لإنشاء حساب والاستفادة من العروض.',
        descriptionEn: 'Invite users to register and get deals.',
        icon: '👤',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'انضم إلينا اليوم',
          titleEn: 'Join us today',
          subtitleAr: 'عروض حصرية للأعضاء + نقاط على كل طلب',
          subtitleEn: 'Member-only deals + points on every order',
          link: '/register',
          layout: 'gradient',
          icon: '👤',
          ctaLabelAr: 'إنشاء حساب',
          ctaLabelEn: 'Sign up',
        },
      },
      {
        value: 'favorites_promo',
        labelAr: 'المفضلة',
        labelEn: 'Favorites promo',
        descriptionAr: 'ذكّر العملاء بقائمة المفضلة.',
        descriptionEn: 'Remind customers about their wishlist.',
        icon: '❤️',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'منتجاتك المفضلة',
          titleEn: 'Your favorites',
          subtitleAr: 'احفظ ما تحب واشتريه لاحقاً',
          subtitleEn: 'Save items you love for later',
          link: '/favorites',
          layout: 'horizontal',
          icon: '❤️',
          ctaLabelAr: 'عرض المفضلة',
          ctaLabelEn: 'View favorites',
        },
      },
      {
        value: 'track_order_promo',
        labelAr: 'تتبع الطلب',
        labelEn: 'Track order promo',
        descriptionAr: 'بطاقة لتتبع حالة الطلب.',
        descriptionEn: 'Card to track order status.',
        icon: '📦',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'أين طلبك؟',
          titleEn: 'Where is your order?',
          subtitleAr: 'تتبع الشحنة خطوة بخطوة',
          subtitleEn: 'Track your delivery step by step',
          link: '/track-order',
          layout: 'horizontal',
          icon: '📦',
          ctaLabelAr: 'تتبع الآن',
          ctaLabelEn: 'Track now',
        },
      },
      {
        value: 'offers_banner',
        labelAr: 'بانر العروض',
        labelEn: 'Offers banner',
        descriptionAr: 'CTA بارز لصفحة العروض.',
        descriptionEn: 'Bold CTA to the offers page.',
        icon: '🏷️',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'عروض لا تفوّت',
          titleEn: 'Deals you cannot miss',
          subtitleAr: 'خصومات جديدة كل يوم',
          subtitleEn: 'New discounts every day',
          link: '/offers',
          layout: 'gradient',
          icon: '🏷️',
          ctaLabelAr: 'تسوق العروض',
          ctaLabelEn: 'Shop offers',
        },
      },
      {
        value: 'faq_teaser',
        labelAr: 'أسئلة شائعة',
        labelEn: 'FAQ teaser',
        descriptionAr: 'رابط لصفحة الأسئلة الشائعة.',
        descriptionEn: 'Link to the FAQ page.',
        icon: '❓',
        fields: { link: true, category: false, products: false, items: false, campaign: false, seo: false, layout: true, cta: true },
        defaults: {
          titleAr: 'أسئلة شائعة',
          titleEn: 'Frequently asked questions',
          subtitleAr: 'التوصيل، الدفع، الاسترجاع — كل الإجابات',
          subtitleEn: 'Delivery, payment, returns — all answers',
          link: '/faq',
          layout: 'centered',
          icon: '❓',
          ctaLabelAr: 'اقرأ المزيد',
          ctaLabelEn: 'Learn more',
        },
      },
    ],
  },
  {
    id: 'content',
    labelAr: 'محتوى وSEO',
    labelEn: 'Content & SEO',
    types: [
      {
        value: 'seo_text',
        labelAr: 'نص SEO',
        labelEn: 'SEO text block',
        descriptionAr: 'فقرة نصية في أسفل الصفحة.',
        descriptionEn: 'Footer text block for search engines.',
        icon: '📝',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: true, layout: false, cta: false },
        defaults: { titleAr: 'عن المتجر', titleEn: 'About our store', sortOrder: 90 },
      },
      {
        value: 'rich_text_block',
        labelAr: 'كتلة نصية غنية',
        labelEn: 'Rich text block',
        descriptionAr: 'فقرة محتوى في منتصف الصفحة — عن المتجر، سياسات، إلخ.',
        descriptionEn: 'Content paragraph mid-page — about store, policies, etc.',
        icon: '📄',
        fields: { link: false, category: false, products: false, items: false, campaign: false, seo: true, layout: true, cta: false },
        defaults: {
          titleAr: 'تسوّق بثقة',
          titleEn: 'Shop with confidence',
          layout: 'centered',
          seoContent: {
            bodyAr: 'نوفر لك أفضل المنتجات اليومية بأسعار منافسة وتوصيل سريع لباب منزلك.',
            bodyEn: 'We bring you everyday essentials at competitive prices with fast delivery to your door.',
          },
        },
      },
    ],
  },
];

export const HOMEPAGE_POPULAR_TYPES = [
  'hero_slider',
  'browse_hub',
  'promo_grid',
  'product_grid',
  'daily_offers',
  'free_delivery_banner',
  'trending_searches',
  'trust_badges',
  'cta_card',
  'loyalty_promo',
  'categories_scroll',
];

/** Flat list for lookups (includes legacy types). */
export const HOMEPAGE_SECTION_TYPES = HOMEPAGE_SECTION_CATEGORIES.flatMap((c) => c.types);

export const HOMEPAGE_CAROUSEL_PRESETS = [
  {
    id: 'best-sellers',
    labelAr: 'الأكثر مبيعاً',
    labelEn: 'Best sellers',
    titleAr: 'الأكثر مبيعاً',
    titleEn: 'Best sellers',
    icon: '⭐',
    link: '/products?section=best-sellers&sort=best-selling',
    productQuery: { sort: 'best-selling', limit: 12, section: 'best-sellers' },
  },
  {
    id: 'new-arrivals',
    labelAr: 'وصل حديثاً',
    labelEn: 'New arrivals',
    titleAr: 'وصل حديثاً',
    titleEn: 'New arrivals',
    icon: '🆕',
    link: '/products?section=new-arrivals&sort=newest',
    productQuery: { sort: 'newest', limit: 12, section: 'new-arrivals' },
  },
  {
    id: 'featured',
    labelAr: 'منتجات مميزة',
    labelEn: 'Featured',
    titleAr: 'منتجات مميزة',
    titleEn: 'Featured products',
    icon: '✨',
    link: '/products?section=featured&featured=true',
    productQuery: { section: 'top', sort: 'newest', limit: 12 },
  },
  {
    id: 'on-sale',
    labelAr: 'تخفيضات',
    labelEn: 'On sale',
    titleAr: 'تخفيضات',
    titleEn: 'On sale',
    icon: '🏷️',
    link: '/products?section=on-sale&sort=discount',
    productQuery: { offers: true, sort: 'discount', limit: 12 },
  },
];

export const PRODUCT_SORT_OPTIONS = [
  { value: 'best-selling', labelAr: 'الأكثر مبيعاً', labelEn: 'Best selling' },
  { value: 'newest', labelAr: 'الأحدث', labelEn: 'Newest' },
  { value: 'discount', labelAr: 'أكبر خصم', labelEn: 'Biggest discount' },
  { value: 'price-asc', labelAr: 'السعر: من الأقل', labelEn: 'Price: low to high' },
  { value: 'price-desc', labelAr: 'السعر: من الأعلى', labelEn: 'Price: high to low' },
];

export const CAMPAIGN_PLACEMENTS = [
  { value: 'hero', labelAr: 'بانر رئيسي (Hero)', labelEn: 'Hero banner' },
  { value: 'promo', labelAr: 'شريط ترويجي (Promo)', labelEn: 'Promo strip' },
  { value: 'sidebar', labelAr: 'الشريط الجانبي', labelEn: 'Sidebar' },
];

export const LAYOUT_OPTIONS = {
  categories_scroll: [
    { value: 'scroll', labelAr: 'تمرير أفقي', labelEn: 'Horizontal scroll' },
    { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid layout' },
  ],
  cta_card: [
    { value: 'horizontal', labelAr: 'أفقي (بطاقة)', labelEn: 'Horizontal card' },
    { value: 'centered', labelAr: 'مركّز', labelEn: 'Centered' },
    { value: 'gradient', labelAr: 'تدرج لوني', labelEn: 'Gradient' },
  ],
  loyalty_promo: [
    { value: 'gradient', labelAr: 'تدرج ذهبي', labelEn: 'Gold gradient' },
    { value: 'horizontal', labelAr: 'بطاقة أفقية', labelEn: 'Horizontal card' },
  ],
  recurring_promo: [
    { value: 'gradient', labelAr: 'تدرج أخضر', labelEn: 'Green gradient' },
    { value: 'horizontal', labelAr: 'بطاقة أفقية', labelEn: 'Horizontal card' },
  ],
  announcement_strip: [
    { value: 'accent', labelAr: 'لون مميز', labelEn: 'Accent color' },
    { value: 'minimal', labelAr: 'بسيط', labelEn: 'Minimal' },
    { value: 'bold', labelAr: 'بارز', labelEn: 'Bold' },
  ],
  flash_strip: [
    { value: 'bold', labelAr: 'بارز', labelEn: 'Bold' },
    { value: 'accent', labelAr: 'لون مميز', labelEn: 'Accent' },
  ],
  product_carousel: [
    { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll' },
    { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
  ],
  product_grid: [
    { value: 'grid', labelAr: 'شبكة 2–4 أعمدة', labelEn: '2–4 column grid' },
    { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll' },
  ],
  image_strip: [
    { value: 'scroll', labelAr: 'شريط أفقي (تمرير)', labelEn: 'Horizontal scroll strip' },
    { value: 'grid', labelAr: 'شبكة بلاطات', labelEn: 'Tile grid' },
  ],
  promo_grid: [
    { value: 'grid', labelAr: 'شبكة بطاقات', labelEn: 'Card grid' },
    { value: 'scroll', labelAr: 'شريط أفقي (تمرير)', labelEn: 'Horizontal scroll strip' },
  ],
  top_rated: [
    { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll' },
    { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
  ],
  flash_sale: [
    { value: 'scroll', labelAr: 'شريط أفقي', labelEn: 'Horizontal scroll' },
    { value: 'grid', labelAr: 'شبكة', labelEn: 'Grid' },
  ],
  rich_text_block: [
    { value: 'centered', labelAr: 'مركّز', labelEn: 'Centered' },
    { value: 'wide', labelAr: 'عرض كامل', labelEn: 'Full width' },
  ],
};

export const ICON_PRESETS = ['🔥', '⭐', '🆕', '🏷️', '✨', '🔍', '📂', '🛒', '💡', '🎁', '🖼️', '🚚', '📍', '📱', '🔁', '📢'];

export function getSectionTypeMeta(type) {
  return HOMEPAGE_SECTION_TYPES.find((t) => t.value === type)
    || HOMEPAGE_SECTION_TYPES.find((t) => t.value === 'product_carousel');
}

export function getSectionCategory(type) {
  return HOMEPAGE_SECTION_CATEGORIES.find((c) => c.types.some((t) => t.value === type));
}

export function sectionFieldsFor(type) {
  return getSectionTypeMeta(type).fields;
}

export function visibleSectionTypes() {
  return HOMEPAGE_SECTION_TYPES.filter((t) => !t.hidden);
}

export function applyCarouselPreset(form, presetId) {
  const preset = HOMEPAGE_CAROUSEL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return form;
  return {
    ...form,
    titleAr: preset.titleAr,
    titleEn: preset.titleEn,
    icon: preset.icon,
    link: preset.link,
    productQuery: { ...form.productQuery, ...preset.productQuery },
    products: [],
  };
}

export function applySectionTypeDefaults(form, newType) {
  const meta = getSectionTypeMeta(newType);
  const next = {
    ...form,
    type: newType,
    layout: meta.defaults?.layout || '',
  };
  if (meta.defaults) {
    Object.assign(next, meta.defaults);
  }
  const fields = sectionFieldsFor(newType);
  if (!fields.products) {
    next.products = [];
    next.productQuery = { sort: 'newest', limit: 12, section: '', brand: '', offers: false };
  }
  if (!fields.items && !fields.splitPromo) {
    next.items = [];
  } else if (fields.splitPromo && meta.defaults?.items) {
    next.items = meta.defaults.items.map((item) => ({ ...item }));
  } else if (fields.items && meta.defaults?.items) {
    next.items = meta.defaults.items.map((item) => ({ ...item }));
  }
  if (!fields.campaign) next.campaignPlacement = '';
  if (fields.hero) {
    next.heroMode = meta.defaults?.heroMode || 'curated';
    next.heroSlides = meta.defaults?.heroSlides ? [...meta.defaults.heroSlides] : [];
    next.heroRotation = { isEnabled: true, startDate: '', endDate: '', runsForever: true, sameFallback: true, fallbackAfterSlides: [], unit: 'week', cycleLength: 4, cycleWeeks: 4, periods: [], slots: [] };
    next.heroAutoplaySeconds = meta.defaults?.heroAutoplaySeconds ?? 6;
    next.gridColumns = meta.defaults?.gridColumns ?? 3;
  } else {
    next.heroMode = 'curated';
    next.heroSlides = [];
    next.heroRotation = { isEnabled: true, startDate: '', endDate: '', runsForever: true, sameFallback: true, fallbackAfterSlides: [], unit: 'week', cycleLength: 4, cycleWeeks: 4, periods: [], slots: [] };
    next.heroAutoplaySeconds = 6;
    next.gridColumns = 3;
  }
  if (!fields.seo) next.seoContent = { bodyAr: '', bodyEn: '' };
  else if (meta.defaults?.seoContent) {
    next.seoContent = { ...emptySeo(), ...meta.defaults.seoContent };
  }
  if (!fields.layout) next.layout = '';
  if (fields.announcement) {
    next.announcementConfig = {
      isEnabled: true,
      startDate: '',
      endDate: '',
      runsForever: true,
      mode: 'single',
      rotateSeconds: 6,
      dismissible: false,
      sticky: false,
      ...(meta.defaults?.announcementConfig || {}),
    };
    if (!meta.defaults?.items) next.items = [];
  } else {
    next.announcementConfig = {
      isEnabled: true,
      startDate: '',
      endDate: '',
      runsForever: true,
      mode: 'single',
      rotateSeconds: 6,
      dismissible: false,
      sticky: false,
    };
  }
  if (fields.splitPromo) {
    next.splitPromoConfig = {
      columns: 2,
      layout: 'balanced',
      cardStyle: 'overlay',
      tileHeight: 'medium',
      gap: 'normal',
      showTitle: false,
      ...(meta.defaults?.splitPromoConfig || {}),
    };
    if (meta.defaults?.items) {
      next.items = meta.defaults.items.map((item) => ({ ...item }));
    } else {
      next.items = [];
    }
  } else {
    next.splitPromoConfig = {
      columns: 2,
      layout: 'balanced',
      cardStyle: 'overlay',
      tileHeight: 'medium',
      gap: 'normal',
      showTitle: false,
    };
  }
  if (fields.browseHub) {
    next.browseConfig = {
      variant: 'split',
      subcategoryCount: 7,
      showProducts: true,
      showSubcategories: true,
      productsLink: '/products',
      subcategoriesLink: '/subcategories',
      ...(meta.defaults?.browseConfig || {}),
    };
    if (newType === 'subcategories_preview') {
      next.browseConfig = { ...next.browseConfig, variant: 'banner', showProducts: false };
      next.browseConfig.subcategoriesLink = next.link || '/subcategories';
    }
    if (newType === 'all_products_entry') {
      next.browseConfig = { ...next.browseConfig, variant: 'products', showSubcategories: false };
      next.browseConfig.productsLink = next.link || '/products';
    }
  } else {
    next.browseConfig = {
      variant: 'split',
      subcategoryCount: 7,
      showProducts: true,
      showSubcategories: true,
      productsLink: '/products',
      subcategoriesLink: '/subcategories',
    };
  }
  if (fields.categoryNav) {
    next.categoryNavConfig = {
      layout: 'scroll',
      columns: 4,
      showTitle: true,
      showViewAll: true,
      viewAllLink: '/categories',
      ...(meta.defaults?.categoryNavConfig || {}),
    };
    if (next.layout === 'grid' || next.layout === 'scroll') {
      next.categoryNavConfig.layout = next.layout;
    }
  } else {
    next.categoryNavConfig = {
      layout: 'scroll',
      columns: 4,
      showTitle: true,
      showViewAll: true,
      viewAllLink: '/categories',
    };
  }
  if (fields.brandRow) {
    next.brandRowConfig = {
      layout: 'scroll',
      columns: 6,
      tileStyle: 'mixed',
      ...(meta.defaults?.brandRowConfig || {}),
    };
  } else {
    next.brandRowConfig = { layout: 'scroll', columns: 6, tileStyle: 'mixed' };
  }
  if (fields.productShowcase) {
    next.productShowcaseConfig = {
      layout: meta.defaults?.productShowcaseConfig?.layout || meta.defaults?.layout || 'scroll',
      columns: 4,
      showViewAll: true,
      ...(meta.defaults?.productShowcaseConfig || {}),
    };
    next.layout = next.productShowcaseConfig.layout;
  } else {
    next.productShowcaseConfig = { layout: 'scroll', columns: 4, showViewAll: true };
  }
  if (fields.dealShowcase) {
    next.dealConfig = {
      style: 'standard',
      showCountdown: true,
      countdownMode: 'end_of_day',
      countdownDurationHours: 6,
      layout: 'scroll',
      columns: 4,
      showSubtitle: true,
      showViewAll: true,
      ...(meta.defaults?.dealConfig || {}),
    };
    next.layout = next.dealConfig.layout;
    if (!next.productQuery?.offers) {
      next.productQuery = { ...next.productQuery, offers: true, sort: 'discount' };
    }
  } else {
    next.dealConfig = { style: 'standard', showCountdown: true, countdownMode: 'end_of_day', countdownDurationHours: 6, layout: 'scroll', columns: 4, showSubtitle: true, showViewAll: true };
  }
  return next;
}

function emptySeo() {
  return { bodyAr: '', bodyEn: '' };
}

export function normalizeHomepageLink(link) {
  if (!link || typeof link !== 'string') return '';
  let s = link.trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+$/, '') || s;
}

export function isProductSectionType(type) {
  return [
    'daily_offers',
    'product_carousel',
    'product_grid',
    'category_spotlight',
    'trending_searches',
    'top_rated',
    'flash_sale',
  ].includes(type);
}

export function isCtaSectionType(type) {
  return [
    'cta_card',
    'signup_promo',
    'favorites_promo',
    'track_order_promo',
    'offers_banner',
    'faq_teaser',
    'all_products_entry',
  ].includes(type);
}

export function productSectionCompact(section) {
  return resolveProductSectionLayout(section).layout === 'scroll';
}

export function isBannerSectionType(type) {
  return ['hero_slider', 'promo_grid', 'image_strip', 'sidebar_banners'].includes(type);
}

/** Shown in admin list for deprecated types still stored in DB */
export function getLegacySectionMergeHint(type, isAr) {
  const hints = {
    flash_strip: {
      ar: '↪ مدمج في «شريط إعلان» — يُفضّل التحويل',
      en: '↪ Merged into Announcement bar — consider converting',
    },
    image_strip: {
      ar: '↪ مدمج في «عروض وبانرات» — يُفضّل التحويل',
      en: '↪ Merged into Promo & banners — consider converting',
    },
    sidebar_banners: {
      ar: '↪ مدمج في «عروض وبانرات» (Sidebar + تلقائي)',
      en: '↪ Merged into Promo & banners (Sidebar + auto)',
    },
    subcategories_preview: {
      ar: '↪ مدمج في «كتلة التصفّح» — نمط بانر',
      en: '↪ Merged into Browse block — banner variant',
    },
    all_products_entry: {
      ar: '↪ مدمج في «كتلة التصفّح» — نمط كل المنتجات',
      en: '↪ Merged into Browse block — all products variant',
    },
    top_categories: {
      ar: '↪ نفس «كتلة التصفّح» — للأقسام القديمة',
      en: '↪ Same as Browse block — legacy section',
    },
    product_carousel: {
      ar: '↪ مدمج في «عرض المنتجات» — شريط أفقي',
      en: '↪ Merged into Product showcase — scroll layout',
    },
    top_rated: {
      ar: '↪ مدمج في «عرض المنتجات» — قالب التقييم',
      en: '↪ Merged into Product showcase — top rated preset',
    },
    flash_sale: {
      ar: '↪ مدمج في «عروض مع عدّاد» — نمط سريع',
      en: '↪ Merged into Deals & countdown — flash style',
    },
  };
  const row = hints[type];
  if (!row) return '';
  return isAr ? row.ar : row.en;
}

export function isLegacyMergedSectionType(type) {
  return [
    'flash_strip',
    'image_strip',
    'sidebar_banners',
    'subcategories_preview',
    'all_products_entry',
    'top_categories',
    'product_carousel',
    'top_rated',
    'flash_sale',
  ].includes(type);
}

export function promoDisplayLayout(section) {
  if (section?.type === 'image_strip') return section.layout || 'scroll';
  if (section?.type === 'sidebar_banners') return 'compact';
  return section?.layout || 'grid';
}
