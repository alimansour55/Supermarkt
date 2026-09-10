import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchHeroBanners } from '../../services/bannerApi';
import { HERO_SLIDES } from '../../data/mockData';
import { HeroSkeleton } from '../ui/Skeleton';

export default function HeroSlider({
  slides: managedSlides = null,
  loading: managedLoading = false,
  autoplaySeconds = 6,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [slides, setSlides] = useState(HERO_SLIDES);
  const [loading, setLoading] = useState(!managedSlides);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (managedSlides !== null && managedSlides !== undefined) {
      setSlides(Array.isArray(managedSlides) ? managedSlides : []);
      setLoading(managedLoading);
      setCurrent(0);
      return undefined;
    }

    setLoading(true);
    fetchHeroBanners()
      .then(setSlides)
      .finally(() => setLoading(false));
  }, [managedLoading, managedSlides]);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % Math.max(slides.length, 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const seconds = Number(autoplaySeconds);
    if (!seconds || seconds <= 0) return undefined;
    const timer = setInterval(next, seconds * 1000);
    return () => clearInterval(timer);
  }, [next, slides.length, autoplaySeconds]);

  if (loading) return <HeroSkeleton />;
  if (!slides.length) return null;

  return (
    <section className="bg-surface-muted py-3 md:py-4">
      <div className="container-app">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="relative h-[190px] sm:h-[260px] md:h-[330px] lg:h-[390px]">
        {slides.map((slide, index) => {
          const hasImage = Boolean(slide.desktopImage || slide.mobileImage || slide.image);
          const imageSrc = slide.desktopImage || slide.image || slide.mobileImage;
          const mobileSrc = slide.mobileImage || slide.desktopImage || slide.image;
          const title = isAr ? slide.titleAr : slide.titleEn;
          const subtitle = isAr ? slide.subtitleAr : slide.subtitleEn;
          const cta = isAr ? (slide.ctaAr || 'تسوق الآن') : (slide.ctaEn || 'Shop now');

          return (
            <div
              key={slide.id || slide._id || `${slide.titleEn || title}-${index}`}
              className={[
                'absolute inset-0 overflow-hidden transition-opacity duration-700',
                index === current ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none',
              ].join(' ')}
            >
              {hasImage ? (
                <>
                  <div className="absolute inset-0 bg-surface-muted">
                    <picture className="block h-full w-full">
                      {slide.mobileImage && mobileSrc !== imageSrc && (
                        <source media="(max-width: 640px)" srcSet={mobileSrc} />
                      )}
                      <img
                        src={imageSrc}
                        alt={title || ''}
                        className="h-full w-full min-h-full min-w-full object-cover object-center"
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding={index === 0 ? 'sync' : 'async'}
                      />
                    </picture>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
                  {(title || subtitle || slide.link) && (
                    <div className="absolute inset-x-0 bottom-0 z-10">
                      <div className="container-app flex items-end justify-between gap-3 pb-8 sm:pb-9">
                        <div className="min-w-0 max-w-[68%] text-white">
                          {title && (
                            <p className="line-clamp-1 text-sm font-extrabold drop-shadow sm:text-lg md:text-2xl">
                              {title}
                            </p>
                          )}
                          {subtitle && (
                            <p className="mt-1 line-clamp-1 text-xs font-medium text-white/90 drop-shadow sm:text-sm">
                              {subtitle}
                            </p>
                          )}
                        </div>
                        {slide.link && (
                          <Link
                            to={slide.link}
                            className="min-h-11 shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-primary-700 shadow-sm transition hover:bg-primary-50 sm:min-h-12 sm:px-6 sm:text-base"
                          >
                            {cta}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`flex h-full items-center bg-gradient-to-br ${slide.gradient || 'from-primary-600 to-primary-800'}`}>
                  <div className="container-app py-8 text-white">
                    <h2 className="max-w-xl text-2xl font-extrabold md:text-4xl">{title}</h2>
                    {subtitle && <p className="mt-2 max-w-lg text-sm text-white/90 md:text-base">{subtitle}</p>}
                    {slide.link && (
                      <Link
                        to={slide.link}
                        className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-white px-5 py-2 text-sm font-extrabold text-primary-700 hover:bg-primary-50"
                      >
                        {cta}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-3 start-1/2 z-20 flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-7 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
                aria-label={`${isAr ? 'شريحة' : 'Slide'} ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCurrent((p) => (p - 1 + slides.length) % slides.length)}
            className="absolute start-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white sm:start-5"
            aria-label={isAr ? 'السابق' : 'Previous'}
          >
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute end-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white sm:end-5"
            aria-label={isAr ? 'التالي' : 'Next'}
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </button>
        </>
      )}
        </div>
      </div>
    </section>
  );
}
