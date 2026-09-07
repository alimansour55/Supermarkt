/**
 * Promo banner grid — three-up cards below hero (Carrefour-style deals row).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { fetchPromoBanners } from '../../services/bannerApi';
import { PROMO_BANNERS } from '../../data/mockData';
import { centeredPromoGridClass, PROMO_TILE_HEIGHT_CLASS } from '../../utils/tileGridShared';
import { Skeleton } from '../ui/Skeleton';

function PromoBannersSkeleton() {
  return (
    <section className="container-app py-6">
      <div className={centeredPromoGridClass(3, 3)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={`${PROMO_TILE_HEIGHT_CLASS} rounded-2xl`} />
        ))}
      </div>
    </section>
  );
}

export default function PromoBanners() {
  const { language } = useLanguage();
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
          <Link
            key={banner.id}
            to={banner.link}
            className={`group relative flex w-full ${PROMO_TILE_HEIGHT_CLASS} items-end overflow-hidden rounded-2xl p-4 text-white shadow-sm transition-transform hover:scale-[1.01] ${
              banner.image ? '' : (banner.bg || 'bg-gradient-to-l from-primary-600 to-primary-800')
            }`}
          >
            {banner.image && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
                  style={{ backgroundImage: `url(${banner.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </>
            )}
            <div className="relative z-10">
              <h3 className="text-lg font-bold md:text-xl">
                {language === 'ar' ? banner.titleAr : banner.titleEn}
              </h3>
              <span className="mt-2 inline-block text-sm font-medium underline underline-offset-2 opacity-90">
                {language === 'ar' ? 'تسوق الآن' : 'Shop Now'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
