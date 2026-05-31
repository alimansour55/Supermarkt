/**
 * Hero slider — Carrefour-style full-width promo carousel.
 * Loads banners from API (seed/admin) with gradient/image fallback.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { fetchHeroBanners } from '../../services/bannerApi';
import { HERO_SLIDES } from '../../data/mockData';
import Loader from '../ui/Loader';

export default function HeroSlider() {
  const { language } = useLanguage();
  const [slides, setSlides] = useState(HERO_SLIDES);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetchHeroBanners()
      .then(setSlides)
      .finally(() => setLoading(false));
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  if (loading) {
    return (
      <section className="flex h-[280px] items-center justify-center bg-primary-50 sm:h-[340px] md:h-[400px]">
        <Loader size="lg" />
      </section>
    );
  }

  if (!slides.length) return null;

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[280px] sm:h-[340px] md:h-[400px]">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            {slide.image ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slide.image})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent" />
              </div>
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-l ${slide.gradient}`} />
            )}

            <div className="relative flex h-full items-center">
              <div className="container-app flex w-full items-center justify-between">
                <div className="max-w-lg text-white">
                  <h2 className="text-2xl font-extrabold md:text-4xl lg:text-5xl">
                    {language === 'ar' ? slide.titleAr : slide.titleEn}
                  </h2>
                  {(slide.subtitleAr || slide.subtitleEn) && (
                    <p className="mt-3 text-sm text-white/90 md:text-lg">
                      {language === 'ar' ? slide.subtitleAr : slide.subtitleEn}
                    </p>
                  )}
                  <Link
                    to={slide.link}
                    className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 md:text-base"
                  >
                    {language === 'ar' ? slide.ctaAr : slide.ctaEn}
                  </Link>
                </div>
                {!slide.image && (
                  <span className="hidden text-[120px] md:block lg:text-[160px]">{slide.emoji}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-4 start-1/2 z-20 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            className={`h-2.5 rounded-full transition-all ${i === current ? 'w-8 bg-white' : 'w-2.5 bg-white/50'}`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* RTL-aware prev/next (start = right in RTL) */}
      <button
        type="button"
        onClick={() => setCurrent((p) => (p - 1 + slides.length) % slides.length)}
        className="absolute start-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white backdrop-blur-sm hover:bg-white/40"
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute end-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white backdrop-blur-sm hover:bg-white/40"
        aria-label="Next slide"
      >
        ›
      </button>
    </section>
  );
}
