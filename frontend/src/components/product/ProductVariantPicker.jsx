import { VARIANT_TYPE_LABELS } from '../../constants/productCatalog';
import { formatPrice } from '../../utils/formatters';

export default function ProductVariantPicker({
  product,
  selectedVariantId,
  onSelect,
  isAr,
}) {
  const variants = product.variants || [];
  if (!variants.length) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-text">
        {isAr ? 'اختر المتغير' : 'Choose option'}
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const label = isAr ? v.valueAr : v.valueEn;
          const typeLabel = VARIANT_TYPE_LABELS[v.type]
            ? (isAr ? VARIANT_TYPE_LABELS[v.type].ar : VARIANT_TYPE_LABELS[v.type].en)
            : v.type;
          const active = selectedVariantId === v._id;
          const out = (v.availableStock ?? v.stock ?? 0) <= 0;

          return (
            <button
              key={v._id}
              type="button"
              disabled={out}
              onClick={() => onSelect(v)}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                active ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-border bg-white hover:border-primary-300',
                out ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              <span className="block text-xs text-text-muted">{typeLabel}</span>
              <span>{label}</span>
              <span className="mt-0.5 block text-xs font-semibold text-primary-700">
                {formatPrice(v.price ?? product.price)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getSelectedVariantLine(product, selectedVariant) {
  if (!selectedVariant) {
    return {
      variantId: null,
      price: product.price,
      inStock: product.inStock,
      availableStock: product.availableStock ?? product.stock,
      sku: product.sku,
      labelAr: null,
      labelEn: null,
    };
  }
  return {
    variantId: selectedVariant._id,
    price: selectedVariant.price ?? product.price,
    inStock: (selectedVariant.availableStock ?? selectedVariant.stock ?? 0) > 0,
    availableStock: selectedVariant.availableStock ?? selectedVariant.stock ?? 0,
    sku: selectedVariant.sku || product.sku,
    labelAr: selectedVariant.valueAr,
    labelEn: selectedVariant.valueEn,
  };
}

export function buildCartProduct(product, line) {
  return {
    ...product,
    _id: product._id,
    productId: product._id,
    variantId: line.variantId,
    cartKey: `${product._id}:${line.variantId || ''}`,
    price: line.price,
    inStock: line.inStock,
    sku: line.sku,
    variantLabelAr: line.labelAr,
    variantLabelEn: line.labelEn,
  };
}
