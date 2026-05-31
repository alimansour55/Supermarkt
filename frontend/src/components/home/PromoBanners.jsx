/**
 * Promo banner grid — three-up cards below hero (Carrefour-style deals row).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { fetchPromoBanners } from '../../services/bannerApi';
import { PROMO_BANNERS } from '../../data/mockData';
import Loader from '../ui/Loader';

export default function PromoBanners() {
  const { language } = useLanguage();
  const [banners, setBanners] = useState(PROMO_BANNERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromoBanners()
      .then(setBanners)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="container-app flex justify-center py-6">
        <Loader />
      </section>
    );
  }

  return (
    <section className="container-app py-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            to={banner.link}
            className={`group relative flex min-h-[120px] items-center justify-between overflow-hidden rounded-2xl p-6 text-white transition-transform hover:scale-[1.02] ${banner.image ? '' : banner.bg}`}
          >
            {banner.image && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
                  style={{ backgroundImage: `url(${banner.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-black/20" />
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
            {!banner.image && (
              <span className="relative z-10 text-5xl transition-transform group-hover:scale-110">{banner.emoji}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
