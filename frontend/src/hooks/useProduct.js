import { useCallback, useEffect, useState } from 'react';
import { fetchProduct } from '../services/productApi';
import { getCachedProduct, setCachedProduct } from '../utils/productCache';
import { isHydrating } from '../utils/hydration';

/**
 * Product by slug.
 * @param {string} slug
 * @param {object} [initialProduct] full product from the SSR loader — used as-is, no refetch
 */
export function useProduct(slug, initialProduct = null) {
  const seeded = slug && initialProduct?.slug === slug ? initialProduct : null;
  const readCache = () => (slug && !isHydrating() ? getCachedProduct(slug) : null);

  const [product, setProduct] = useState(() => seeded || readCache());
  const [loading, setLoading] = useState(() => !(seeded || readCache()));
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      setLoading(false);
      return undefined;
    }

    // Fresh from the server: prime the client cache and skip the network.
    if (seeded && reloadKey === 0) {
      setCachedProduct(slug, seeded);
      setProduct(seeded);
      setLoading(false);
      return undefined;
    }

    const cached = getCachedProduct(slug);
    if (cached) {
      setProduct(cached);
      setLoading(false);
    } else {
      setProduct(null);
      setLoading(true);
    }

    let active = true;
    fetchProduct(slug, { revalidate: Boolean(cached) })
      .then((data) => {
        if (active) setProduct(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  // `seeded` is derived from props; re-running on its identity would refetch needlessly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reloadKey]);

  return { product, loading, refetch };
}
