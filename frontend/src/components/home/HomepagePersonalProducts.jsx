import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useHydrated } from '../ui/ClientOnly';
import ProductSection from './ProductSection';
import { useHomepagePreview } from './homepagePreviewContext';
import { RECENTLY_VIEWED_EVENT, clearRecentlyViewed, getRecentlyViewedIds } from '../../utils/recentlyViewed';

/** Re-read the viewed ids when another tab (or the product page) changes them. */
function useViewedIds(enabled) {
  const [ids, setIds] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    const read = () => setIds(getRecentlyViewedIds());
    read();
    window.addEventListener(RECENTLY_VIEWED_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, [enabled]);
  return ids;
}

async function loadProducts(type, { ids, limit, fallback }) {
  if (type === 'recently_viewed') {
    if (!ids.length) return [];
    const { data } = await api.post('/homepage-sections/recently-viewed', { ids, limit });
    return data.data || [];
  }
  if (type === 'picked_for_you') {
    const { data } = await api.post('/homepage-sections/picked-for-you', { ids: ids.slice(0, 12), limit, fallback });
    return data.data?.products || [];
  }
  if (type === 'buy_again') {
    const { data } = await api.get('/homepage-sections/buy-again', { params: { limit } });
    return data.data || [];
  }
  return [];
}

/**
 * "Recently viewed", "Picked for you" and "Buy it again". The homepage is
 * cached and server-rendered for everyone, so these render nothing on the
 * server and during hydration, then load this shopper's products. Hidden when
 * there is nothing to show.
 */
export default function HomepagePersonalProducts({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const preview = useHomepagePreview();
  const hydrated = useHydrated();
  const { user, loading: authLoading } = useAuth();
  const cfg = section.blockConfig || {};
  const limit = Number(cfg.limit) || 12;
  const live = hydrated && !preview;
  const ids = useViewedIds(live && section.type !== 'buy_again');
  const userId = user?._id || user?.id || null;
  const [products, setProducts] = useState([]);

  const needsUser = section.type === 'buy_again';
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!live || authLoading) return undefined;
    if (needsUser && !userId) return undefined;
    let active = true;
    loadProducts(section.type, { ids, limit, fallback: cfg.pickedFallback })
      .then((list) => { if (active) setProducts(list); })
      .catch(() => { if (active) setProducts([]); });
    return () => { active = false; };
    // ids are compared by value through idsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, authLoading, userId, idsKey, limit, cfg.pickedFallback, section.type, needsUser]);

  const signedOut = needsUser && !userId;
  const shown = preview ? (section.sampleProducts || []).slice(0, limit) : (signedOut ? [] : products);
  if (!shown.length) return null;

  return (
    <div className="container-app">
      {preview && (
        <p className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-900">
          {isAr ? 'مثال — كل عميل يرى منتجاته الخاصة' : 'Example — each shopper sees their own products'}
        </p>
      )}
      <ProductSection
        titleAr={section.titleAr}
        titleEn={section.titleEn}
        subtitleAr={section.subtitleAr}
        subtitleEn={section.subtitleEn}
        icon={section.icon}
        products={shown}
        link={section.type === 'buy_again' ? '/orders' : null}
        layout={cfg.layout === 'grid' ? 'grid' : 'scroll'}
        columns={Number(cfg.columns) || 4}
        showViewAll={section.type === 'buy_again'}
      />
      {section.type === 'recently_viewed' && !preview && (
        <button
          type="button"
          onClick={() => { clearRecentlyViewed(); setProducts([]); }}
          className="-mt-3 mb-2 text-xs font-medium text-text-muted underline-offset-2 hover:underline"
        >
          {isAr ? 'مسح السجل' : 'Clear history'}
        </button>
      )}
    </div>
  );
}
