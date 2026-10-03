import { z } from 'zod';
import { validateProductCategoryLeaf } from './productFormValidation';
import { buildCategorySelectionFromLeaf } from '../../utils/categoryHelpers';
import { CUSTOM_UNIT_VALUE } from '../../constants/productUnits';

const numberOrString = z.union([z.string(), z.number()]);

const variantSchema = z.object({
  type: z.string().default('size'),
  valueAr: z.string().optional().default(''),
  valueEn: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  barcode: z.string().optional().default(''),
  price: numberOrString.optional().default(''),
  wholesalePrice: numberOrString.optional().default(''),
  stock: numberOrString.optional().default(0),
  isDefault: z.boolean().optional().default(false),
});

const specSchema = z.object({
  keyAr: z.string().optional().default(''),
  keyEn: z.string().optional().default(''),
  valueAr: z.string().optional().default(''),
  valueEn: z.string().optional().default(''),
});

export function buildProductSchema(isAr, categories = []) {
  const msg = (ar, en) => (isAr ? ar : en);

  return z.object({
    nameAr: z.string().trim().min(1, msg('الاسم العربي مطلوب', 'Arabic name is required')),
    nameEn: z.string().trim().min(1, msg('الاسم الإنجليزي مطلوب', 'English name is required')),
    slug: z.string().optional().default(''),
    descriptionAr: z.string().optional().default(''),
    descriptionEn: z.string().optional().default(''),
    price: numberOrString,
    wholesalePrice: numberOrString.optional().default(''),
    oldPrice: numberOrString.optional().default(''),
    mainCategory: z.string().optional().default(''),
    subCategory: z.string().optional().default(''),
    category: z.string().optional().default(''),
    brand: z.string().optional().default(''),
    stock: numberOrString,
    unit: z.string().optional().default('piece'),
    unitAr: z.string().optional().default(''),
    unitEn: z.string().optional().default(''),
    emoji: z.string().optional().default('🛍️'),
    isFeatured: z.boolean().optional().default(false),
    isOffer: z.boolean().optional().default(false),
    isBestSeller: z.boolean().optional().default(false),
    isOurProduct: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    sku: z.string().optional().default(''),
    barcode: z.string().optional().default(''),
    variants: z.array(variantSchema).optional().default([]),
    specs: z.array(specSchema).optional().default([]),
    frequentlyBoughtTogether: z.array(z.string()).optional().default([]),
    similarProducts: z.array(z.string()).optional().default([]),
    similarMode: z.enum(['auto', 'manual', 'off']).optional().default('auto'),
  }).superRefine((data, ctx) => {
    if (data.price === '' || data.price == null) {
      ctx.addIssue({ code: 'custom', message: msg('سعر البيع مطلوب', 'Selling price is required'), path: ['price'] });
    } else if (Number(data.price) < 0) {
      ctx.addIssue({ code: 'custom', message: msg('سعر البيع لا يمكن أن يكون سالباً', 'Selling price cannot be negative'), path: ['price'] });
    }

    if (data.wholesalePrice !== '' && data.wholesalePrice != null) {
      const wholesale = Number(data.wholesalePrice);
      const price = Number(data.price);
      if (!Number.isNaN(wholesale) && wholesale < 0) {
        ctx.addIssue({ code: 'custom', message: msg('سعر الجملة لا يمكن أن يكون سالباً', 'Wholesale price cannot be negative'), path: ['wholesalePrice'] });
      } else if (!Number.isNaN(wholesale) && !Number.isNaN(price) && wholesale > price) {
        ctx.addIssue({ code: 'custom', message: msg('سعر الجملة يجب أن يكون أقل من أو يساوي سعر البيع', 'Wholesale price must be at or below selling price'), path: ['wholesalePrice'] });
      }
    }

    if (data.stock === '' || data.stock == null) {
      ctx.addIssue({ code: 'custom', message: msg('المخزون مطلوب', 'Stock is required'), path: ['stock'] });
    } else if (Number(data.stock) < 0) {
      ctx.addIssue({ code: 'custom', message: msg('المخزون لا يمكن أن يكون سالباً', 'Stock cannot be negative'), path: ['stock'] });
    }

    if (data.oldPrice !== '' && data.oldPrice != null) {
      const old = Number(data.oldPrice);
      const price = Number(data.price);
      if (!Number.isNaN(old) && !Number.isNaN(price) && old > 0 && old <= price) {
        ctx.addIssue({ code: 'custom', message: msg('السعر القديم يجب أن يكون أعلى من السعر الحالي', 'Old price must be higher than current price'), path: ['oldPrice'] });
      }
    }

    const leafError = validateProductCategoryLeaf(data.subCategory, categories, isAr);
    if (leafError) {
      ctx.addIssue({ code: 'custom', message: leafError, path: ['subCategory'] });
    }
  });
}

export const emptyFormValues = {
  nameAr: '',
  nameEn: '',
  slug: '',
  descriptionAr: '',
  descriptionEn: '',
  price: '',
  wholesalePrice: '',
  oldPrice: '',
  category: '',
  mainCategory: '',
  subCategory: '',
  brand: '',
  stock: '',
  unit: 'piece',
  unitAr: 'قطعة',
  unitEn: 'Piece',
  emoji: '🛍️',
  isFeatured: false,
  isOffer: false,
  isBestSeller: false,
  isOurProduct: false,
  isActive: true,
  sku: '',
  barcode: '',
  variants: [],
  specs: [],
  frequentlyBoughtTogether: [],
  similarProducts: [],
  similarMode: 'auto',
};

export function buildEmptyFormValues() {
  return { ...emptyFormValues };
}

/** Defaults kept after "Save & add another"; category and product identity are cleared. */
export function buildFormValuesForAnother(previous) {
  return {
    ...emptyFormValues,
    brand: previous.brand || emptyFormValues.brand,
    unit: previous.unit || emptyFormValues.unit,
    unitAr: previous.unitAr || emptyFormValues.unitAr,
    unitEn: previous.unitEn || emptyFormValues.unitEn,
    emoji: previous.emoji || emptyFormValues.emoji,
    isActive: previous.isActive !== false,
    wholesalePrice: previous.wholesalePrice !== '' && previous.wholesalePrice != null
      ? previous.wholesalePrice
      : '',
    category: '',
    mainCategory: '',
    subCategory: '',
  };
}

export function mapProductToFormValues(p) {
  const leafId = p.subCategory || p.categoryId || p.category || '';
  return {
    nameAr: p.nameAr || p.name || '',
    nameEn: p.nameEn || '',
    slug: p.slug || '',
    descriptionAr: p.descriptionAr || p.description || '',
    descriptionEn: p.descriptionEn || '',
    price: p.price,
    wholesalePrice: p.wholesalePrice ?? '',
    oldPrice: p.oldPrice || '',
    mainCategory: p.mainCategory || '',
    subCategory: leafId,
    category: leafId,
    brand: p.brand || '',
    stock: p.stock,
    unit: p.unit || 'piece',
    unitAr: p.unitAr || '',
    unitEn: p.unitEn || '',
    emoji: p.emoji || '🛍️',
    isFeatured: p.isFeatured || false,
    isOffer: p.isOffer || false,
    isBestSeller: p.isBestSeller || false,
    isOurProduct: p.isOurProduct || false,
    isActive: p.isActive !== false,
    sku: p.sku || '',
    barcode: p.barcode || '',
    variants: p.variants || [],
    specs: p.specs || [],
    frequentlyBoughtTogether: (p.frequentlyBoughtTogether || []).map(String),
    similarProducts: (p.similarProducts || []).map(String),
    similarMode: p.similarMode || 'auto',
  };
}

export function mapFormValuesToPayload(values, categories) {
  const { subCategory, ...rest } = values;
  const mainCategory = values.mainCategory || (subCategory
    ? String(buildCategorySelectionFromLeaf(categories, subCategory).level1 || '')
    : '');
  return {
    ...rest,
    mainCategory,
    category: subCategory,
    price: Number(values.price),
    wholesalePrice: values.wholesalePrice !== '' && values.wholesalePrice != null
      ? Number(values.wholesalePrice)
      : 0,
    oldPrice: values.oldPrice ? Number(values.oldPrice) : null,
    stock: Number(values.stock),
    variants: (values.variants || []).map((v) => ({
      ...v,
      price: v.price !== '' && v.price != null ? Number(v.price) : Number(values.price),
      wholesalePrice: v.wholesalePrice !== '' && v.wholesalePrice != null ? Number(v.wholesalePrice) : 0,
      stock: Number(v.stock || 0),
    })),
    specs: values.specs || [],
    frequentlyBoughtTogether: values.frequentlyBoughtTogether || [],
    similarProducts: values.similarProducts || [],
  };
}

export { CUSTOM_UNIT_VALUE };
