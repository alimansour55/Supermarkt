import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { fetchProduct } from '../../services/productApi';
import { productService } from '../../services/apiServices';
import { getProductAvailableStock } from '../../utils/productHelpers';
import { formatPrice } from '../../utils/formatters';
import ProductCard from '../product/ProductCard';

const MAX_ITEMS = 10;

function isBuyable(product) {
  // Real catalog ids only — never demo fallback items.
  if (!/^[a-f0-9]{24}$/i.test(String(product?._id || '')) || product.isActive === false) return false;
  const stock = getProductAvailableStock(product);
  return stock == null || stock > 0;
}

/**
 * "Complete your cart" strip: bought-together and similar items for the newest cart
 * line, topped up with best sellers. Items already in the cart are left out; while
 * free delivery isn't reached yet, the heading says how much is missing.
 * With an empty cart it simply shows best sellers.
 */
export default function CartRecommendations({ className = '' }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { items, freeDeliveryRemaining, freeDeliveryMethods, hasStoreItems } = useCart();
  const [pool, setPool] = useState([]);

  // Re-fetch only when the anchor product changes, not on every quantity tap.
  const anchorSlug = items.length ? (items[items.length - 1].slug || null) : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [anchor, bestSellers] = await Promise.all([
        anchorSlug ? fetchProduct(anchorSlug).catch(() => null) : null,
        // Straight to the API: the list helper falls back to demo data on errors.
        productService.getAll({ sort: 'best-selling', limit: 16 })
          .then(({ data }) => data?.data || [])
          .catch(() => []),
      ]);
      if (cancelled) return;
      setPool([
        ...(anchor?.frequentlyBoughtTogetherProducts || []),
        ...(anchor?.relatedProducts || []),
        ...(Array.isArray(bestSellers) ? bestSellers : []),
      ]);
    };
    load();
    return () => { cancelled = true; };
  }, [anchorSlug]);

  const inCart = useMemo(() => new Set(items.map((item) => String(item.productId))), [items]);

  const products = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const product of pool) {
      const id = String(product?._id || '');
      if (!id || seen.has(id) || inCart.has(id) || !isBuyable(product)) continue;
      seen.add(id);
      out.push(product);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  }, [pool, inCart]);

  if (!products.length) return null;

  const missingForFree = items.length && hasStoreItems && freeDeliveryMethods?.length && freeDeliveryRemaining > 0
    ? freeDeliveryRemaining
    : 0;
  const title = !items.length
    ? (isAr ? 'الأكثر طلباً' : 'Popular right now')
    : (isAr ? 'أكمل سلتك' : 'Complete your cart');

  return (
    <section className={className} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <Sparkles className="h-5 w-5 text-primary-600" aria-hidden />
          {title}
        </h2>
        {missingForFree > 0 && (
          <p className="text-xs font-semibold text-primary-700">
            {isAr
              ? `أضف ${formatPrice(missingForFree)} واحصل على توصيل مجاني`
              : `Add ${formatPrice(missingForFree)} more for free delivery`}
          </p>
        )}
      </div>
      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 scrollbar-thin [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0">
        {products.map((product) => (
          <div key={product._id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18%]">
            <ProductCard product={product} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
