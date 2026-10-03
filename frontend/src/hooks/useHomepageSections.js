import { useCallback, useEffect, useState } from 'react';
import { fetchHomepageSections } from '../services/homepageApi';
import {
  getCachedHomepageSections,
  getInflightHomepage,
  setCachedHomepageSections,
  trackHomepageInflight,
} from '../utils/homepageCache';
import { seedProductListCache } from '../utils/productCache';
import { isHydrating } from '../utils/hydration';

function seedProductsFromSections(sections = []) {
  sections.forEach((section) => {
    if (section?.products?.length) seedProductListCache(section.products);
  });
}

/**
 * Homepage CMS sections.
 * @param {object[]|null} [initialSections] sections from the SSR loader — used as-is, no refetch
 */
export function useHomepageSections(initialSections = null) {
  const seeded = Array.isArray(initialSections) ? initialSections : null;
  const readCache = () => (isHydrating() ? null : getCachedHomepageSections());
  const [sections, setSections] = useState(() => seeded || readCache());
  const [loading, setLoading] = useState(() => !(seeded || readCache()));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    // Fresh from the server: prime the client caches and skip the network.
    if (seeded && reloadKey === 0) {
      setCachedHomepageSections(seeded);
      seedProductsFromSections(seeded);
      return undefined;
    }

    const cached = getCachedHomepageSections();
    if (cached) {
      setSections(cached);
      setLoading(false);
      seedProductsFromSections(cached);
    } else {
      setLoading(true);
    }

    let active = true;
    const inflight = getInflightHomepage();
    const load = inflight || trackHomepageInflight(
      fetchHomepageSections({ revalidate: Boolean(cached) })
        .then((data) => {
          setCachedHomepageSections(data);
          seedProductsFromSections(data);
          return data;
        }),
    );

    load
      .then((data) => {
        if (active) {
          setSections(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active && !cached) {
          setSections(null);
          setError(err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  // `seeded` comes from loader data captured on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return { sections, loading: loading && !sections, error, refetch };
}
