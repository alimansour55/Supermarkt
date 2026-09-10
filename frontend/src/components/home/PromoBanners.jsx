/**
 * Promo banner grid — three-up cards below hero (Carrefour-style deals row).
 */
import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchPromoBanners } from '../../services/bannerApi';
import { PROMO_BANNERS } from '../../data/mockData';
import { centeredPromoGridClass } from '../../utils/tileGridShared';
import { Skeleton } from '../ui/Skeleton';
import PromoBannerTile, { PROMO_BANNER_TILE_HEIGHT } from './PromoBannerTile';

function PromoBannersSkeleton() {
  return (
    <section className="container-app py-6">
      <div className={centeredPromoGridClass(3, 3)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={`${PROMO_BANNER_TILE_HEIGHT} rounded-2xl`} />
        ))}
      </div>
    </section>
  );
}

export default function PromoBanners() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [banners, setBanners] = useState(PROMO_BANNERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromoBanners()
      .then(setBanners)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PromoBannersSkeleton />;

  return (
    <section className="container-app py-6">
      <div className={centeredPromoGridClass(banners.length, 3)}>
        {banners.map((banner) => (
          <PromoBannerTile key={banner._id || banner.id} banner={banner} isAr={isAr} />
        ))}
      </div>
    </section>
  );
}
