/** Helpers for building cleaning-catalog seed documents. */

export function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function deterministicFlags(slug) {
  const h = hashString(slug);
  return {
    isFeatured: h % 7 === 0,
    isBestSeller: h % 11 === 0,
    isOffer: h % 5 === 0,
  };
}

export function deterministicStock(slug, min = 18, max = 180) {
  const h = hashString(`${slug}-stock`);
  return min + (h % (max - min + 1));
}

export function deterministicSoldCount(slug) {
  const h = hashString(`${slug}-sold`);
  return 20 + (h % 850);
}

export function categoryImagePath(slug) {
  return `/images/categories/${slug}.jpg`;
}

export function brandImagePath(brandSlug) {
  return `/images/brands/${brandSlug}.jpg`;
}

export function productImagePath(productSlug) {
  return `/images/products/${productSlug}.jpg`;
}

export function productImageUrl(productSlug, label) {
  const text = encodeURIComponent(String(label || productSlug).slice(0, 40));
  return `https://placehold.co/600x600/f1f5f9/475569?text=${text}`;
}

function parseNumericSize(nameEn = '', size = '') {
  if (size) return Number.parseFloat(size) || null;
  const kg = nameEn.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return Number.parseFloat(kg[1]);
  const l = nameEn.match(/(\d+(?:\.\d+)?)\s*l\b/i);
  if (l) return Number.parseFloat(l[1]);
  const ml = nameEn.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (ml) return Number.parseFloat(ml[1]) / 1000;
  const g = nameEn.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (g) return Number.parseFloat(g[1]) / 1000;
  const tabs = nameEn.match(/(\d+)\s*tabs/i);
  if (tabs) return Number.parseFloat(tabs[1]);
  const wipes = nameEn.match(/(\d+)\s*wipes/i);
  if (wipes) return Number.parseFloat(wipes[1]);
  const pads = nameEn.match(/(\d+)\s*pads/i);
  if (pads) return Number.parseFloat(pads[1]);
  const rolls = nameEn.match(/(\d+)\s*rolls/i);
  if (rolls) return Number.parseFloat(rolls[1]);
  const bags = nameEn.match(/(\d+)\s*bags/i);
  if (bags) return Number.parseFloat(bags[1]);
  const pieces = nameEn.match(/(\d+)\s*pieces/i);
  if (pieces) return Number.parseFloat(pieces[1]);
  const sizeMatch = nameEn.match(/size\s*(\d+)/i);
  if (sizeMatch) return Number.parseFloat(sizeMatch[1]);
  return null;
}

function categoryPriceBase(mainSlug) {
  const bases = {
    'washing-powder': 42,
    'laundry-gel': 38,
    'fabric-softener': 32,
    'dishwashing-liquid': 18,
    'dishwasher-products': 95,
    disinfectants: 28,
    'floor-cleaner': 35,
    'bathroom-toilet-cleaner': 32,
    'kitchen-cleaner-grease-remover': 38,
    'glass-cleaner': 28,
    'bath-soap': 12,
    'shower-gel': 45,
    'bath-loofah': 22,
    'hand-wash': 28,
    'baby-diapers': 185,
    'baby-wet-wipes': 35,
    'baby-shampoo': 38,
    'baby-cream-powder': 55,
    'facial-tissues': 42,
    'kitchen-towels': 38,
    'toilet-paper': 48,
    'trash-bags': 28,
    'foil-cling-film-storage-bags': 22,
    'sponges-dish-scrubbers': 18,
    'mops-buckets': 120,
    'cleaning-cloths-microfiber': 25,
    'cleaning-brushes': 35,
    'insect-killers': 48,
    'air-fresheners': 55,
    shampoo: 52,
    'hair-conditioner': 48,
    deodorant: 38,
    toothpaste: 22,
    toothbrushes: 18,
    'sanitary-pads': 42,
    'body-cream-lotion': 58,
  };
  return bases[mainSlug] || 35;
}

export function estimatePrice(mainSlug, product) {
  const numeric = parseNumericSize(product.nameEn, product.size);
  const base = categoryPriceBase(mainSlug);
  let price = base;

  if (numeric != null) {
    if (product.unitEn === 'kg' || product.unitAr === 'كيلو') {
      price = Math.round(base * numeric * 0.92);
    } else if (product.unitEn === 'L' || product.unitAr === 'لتر') {
      price = Math.round(base * numeric * 0.88);
    } else if (product.unitEn === 'ml' || product.unitAr === 'مل') {
      price = Math.round((base * numeric) / 8);
    } else if (product.unitEn === 'g' || product.unitAr === 'جم') {
      price = Math.round((base * numeric) / 4);
    } else if (product.unitEn === 'piece' || product.unitAr === 'قطعة') {
      price = Math.round(base + numeric * 1.8);
    } else {
      price = Math.round(base + numeric * 2.5);
    }
  }

  const h = hashString(product.nameEn || product.nameAr);
  price += (h % 17) - 8;
  price = Math.max(8, Math.round(price * 100) / 100);

  if (price % 1 === 0 && price > 20) {
    price -= 0.01;
  }
  return price;
}

export function buildOldPrice(price, isOffer) {
  if (!isOffer) return null;
  const bump = 0.08 + (hashString(String(price)) % 12) / 100;
  return Math.round(price * (1 + bump) * 100) / 100;
}

function uniqueKeywords(words = []) {
  return [...new Set(words.map((w) => String(w).trim()).filter(Boolean))];
}

export function buildSearchKeywords({
  nameAr,
  nameEn,
  brandAr,
  brandEn,
  mainNameAr,
  mainNameEn,
}) {
  const arParts = [
    nameAr,
    brandAr,
    mainNameAr,
    ...(nameAr?.split(/\s+/) || []),
    brandAr?.replace(/\s+/g, ''),
  ];
  const enParts = [
    nameEn,
    brandEn,
    mainNameEn,
    ...(nameEn?.split(/\s+/) || []),
    brandEn?.toLowerCase(),
  ];

  return {
    searchKeywordsAr: uniqueKeywords(arParts),
    searchKeywordsEn: uniqueKeywords(enParts.map((w) => w.toLowerCase())),
  };
}

export function buildSku(productSlug) {
  const compact = productSlug.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `MP-${compact}`;
}

export function buildBarcode(productSlug) {
  const h = hashString(`${productSlug}-barcode`) % 10000000000;
  return `622${String(h).padStart(10, '0')}`;
}

export function buildUnitFields(product) {
  if (product.unitAr && product.unitEn) {
    return {
      unitAr: product.unitAr,
      unitEn: product.unitEn,
      unit: product.unitAr,
    };
  }
  return { unitAr: 'قطعة', unitEn: 'piece', unit: 'قطعة' };
}

export function buildProductDoc({
  product,
  productSlug,
  main,
  brand,
  mainId,
  subId,
}) {
  const flags = deterministicFlags(productSlug);
  const price = estimatePrice(main.slug, product);
  const oldPrice = buildOldPrice(price, flags.isOffer);
  const images = [
    productImagePath(productSlug),
    productImageUrl(productSlug, brand.nameEn),
  ];
  const units = buildUnitFields(product);
  const keywords = buildSearchKeywords({
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    brandAr: brand.nameAr,
    brandEn: brand.nameEn,
    mainNameAr: main.nameAr,
    mainNameEn: main.nameEn,
  });

  return {
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    slug: productSlug,
    descriptionAr: `${product.nameAr} — ${brand.nameAr} — ${main.nameAr}`,
    descriptionEn: `${product.nameEn} — ${brand.nameEn} — ${main.nameEn}`,
    price,
    oldPrice,
    mainCategory: mainId,
    subCategory: subId,
    category: subId,
    brand: brand.nameEn,
    brandAr: brand.nameAr,
    brandEn: brand.nameEn,
    size: product.size || '',
    ...units,
    ...keywords,
    sku: buildSku(productSlug),
    barcode: buildBarcode(productSlug),
    stock: deterministicStock(productSlug),
    soldCount: deterministicSoldCount(productSlug),
    images,
    emoji: main.icon || '🛍️',
    isActive: true,
    isFeatured: flags.isFeatured,
    isBestSeller: flags.isBestSeller,
    isOffer: flags.isOffer,
  };
}
