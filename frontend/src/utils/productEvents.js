import api from '../services/api';

/**
 * Best-effort traffic counters for marketplace seller products (powers the seller's
 * "Traffic & conversion" report). One view per product per browser session; never throws.
 */
export function trackProductEvent(product, type) {
  try {
    if (typeof window === 'undefined' || !product?.soldBy) return;
    const id = product._id || product.productId;
    if (!id) return;
    if (type === 'view') {
      const key = `pe:view:${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    }
    api.post('/product-events', { product: id, type }).catch(() => {});
  } catch {
    /* storage blocked or offline — counting is optional */
  }
}
