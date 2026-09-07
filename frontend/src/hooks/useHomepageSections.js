import { useCallback, useEffect, useState } from 'react';
import { fetchHomepageSections } from '../services/homepageApi';
import {
  getCachedHomepageSections,
  getInflightHomepage,
  setCachedHomepageSections,
  trackHomepageInflight,
} from '../utils/homepageCache';
import { seedProductListCache } from '../utils/productCache';

function seedProductsFromSections(sections = []) {
  sections.forEach((section) => {
    if (section?.products?.length) seedProductListCache(section.products);
  });
}

export function useHomepageSections() {
  const [sections, setSections] = useState(() => getCachedHomepageSections());
  const [loading, setLoading] = useState(() => !getCachedHomepageSections());
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
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
  }, [reloadKey]);

  return { sections, loading: loading && !sections, error, refetch };
}
