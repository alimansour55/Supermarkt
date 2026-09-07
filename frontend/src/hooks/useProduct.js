import { useCallback, useEffect, useState } from 'react';
import { fetchProduct } from '../services/productApi';
import { getCachedProduct } from '../utils/productCache';

export function useProduct(slug) {
  const [product, setProduct] = useState(() => (slug ? getCachedProduct(slug) : null));
  const [loading, setLoading] = useState(() => !(slug && getCachedProduct(slug)));
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
  }, [slug, reloadKey]);

  return { product, loading, refetch };
}
