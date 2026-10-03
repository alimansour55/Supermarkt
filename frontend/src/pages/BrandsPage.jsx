import { useEffect, useMemo, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';
import { Search, Tag, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchBrands } from '../services/brandApi';
import { SHOP_BRANDS } from '../data/shopBrands';
import {
  AR_ALPHABET,
  EN_ALPHABET,
  brandIndexLetter,
  brandProductHref,
  getBrandLabel,
  normalizeBrandEntry,
} from '../utils/shopBrandHelpers';

function BrandTile({ brand, isAr }) {
  const label = getBrandLabel(brand, isAr);
  const href = brand.link || brandProductHref(brand.query);

  return (
    <Link
      to={href}
      className="group flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md active:scale-[0.98]"
    >
      {brand.image ? (
        <img src={brand.image} alt="" className="h-10 w-16 object-contain" loading="lazy" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-2xl transition group-hover:bg-primary-100">
          {brand.emoji || '🏷️'}
        </span>
      )}
      <span className="line-clamp-2 text-center text-sm font-bold text-text">{label}</span>
      {typeof brand.count === 'number' && (
        <span className="text-[11px] font-medium text-text-muted">
          {brand.count} {isAr ? 'منتج' : brand.count === 1 ? 'product' : 'products'}
        </span>
      )}
    </Link>
  );
}

export default function BrandsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const loaderData = useLoaderData();
  const ssrBrands = Array.isArray(loaderData?.brands) ? loaderData.brands : null;
  const [brands, setBrands] = useState(() => (ssrBrands || SHOP_BRANDS).map(normalizeBrandEntry));
  const [loading, setLoading] = useState(!ssrBrands);
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState(null);

  useEffect(() => {
    // Already rendered by the server.
    if (ssrBrands) return undefined;
    let active = true;
    setLoading(true);
    fetchBrands()
      .then((rows) => {
        if (!active) return;
        setBrands(rows.map(normalizeBrandEntry));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  // Mount only — `ssrBrands` is the loader data captured on first render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Index letter each brand is filed under, based on the displayed-language name.
  const letterOf = useMemo(
    () => (brand) => brandIndexLetter(getBrandLabel(brand, isAr)),
    [isAr],
  );

  const alphabet = isAr ? AR_ALPHABET : EN_ALPHABET;

  const availableLetters = useMemo(
    () => new Set(brands.map(letterOf)),
    [brands, letterOf],
  );

  // Ignore a stale selection after switching language (Arabic ↔ English index).
  const activeLetter = letter && alphabet.includes(letter) ? letter : null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return brands.filter((brand) => {
      if (activeLetter && letterOf(brand) !== activeLetter) return false;
      if (!needle) return true;
      const labelAr = getBrandLabel(brand, true).toLowerCase();
      const labelEn = getBrandLabel(brand, false).toLowerCase();
      const q = (brand.query || '').toLowerCase();
      return labelAr.includes(needle) || labelEn.includes(needle) || q.includes(needle);
    });
  }, [brands, query, activeLetter, letterOf]);

  return (
    <div className="pb-12">
      <section className="bg-gradient-to-br from-violet-700 via-primary-600 to-emerald-600 text-white">
        <div className="container-app py-8 md:py-10">
          <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-white/80">
            <Link to="/" className="hover:text-white">{isAr ? 'الرئيسية' : 'Home'}</Link>
            <span className="opacity-60">/</span>
            <span className="font-medium text-white">{isAr ? 'العلامات التجارية' : 'Brands'}</span>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="flex items-center gap-3 text-2xl font-bold md:text-4xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Tag className="h-6 w-6" aria-hidden />
                </span>
                {isAr ? 'تسوق حسب العلامة' : 'Shop by brand'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/90 md:text-base">
                {isAr
                  ? 'كل العلامات في مكان واحد — اختر علامة لعرض منتجاتها'
                  : 'All brands in one place — pick a brand to browse its products'}
              </p>
              {!loading && (
                <span className="mt-5 inline-flex rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-sm">
                  {brands.length} {isAr ? 'علامة' : brands.length === 1 ? 'brand' : 'brands'}
                </span>
              )}
            </div>

            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? 'ابحث عن علامة...' : 'Search brands...'}
                className="w-full rounded-2xl border-0 bg-white py-3 pe-10 ps-10 text-sm text-text shadow-sm outline-none ring-primary-300 focus:ring-2"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-muted hover:bg-surface-muted"
                  aria-label={isAr ? 'مسح' : 'Clear'}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container-app flex items-center gap-1.5 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setLetter(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
              activeLetter === null
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-surface-muted text-text-muted hover:bg-primary-50 hover:text-primary-700'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          {alphabet.map((ch) => {
            const enabled = availableLetters.has(ch);
            const active = activeLetter === ch;
            return (
              <button
                key={ch}
                type="button"
                disabled={!enabled}
                onClick={() => setLetter(active ? null : ch)}
                className={`h-9 w-9 shrink-0 rounded-full text-sm font-bold transition ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : enabled
                      ? 'bg-surface-muted text-text hover:bg-primary-50 hover:text-primary-700'
                      : 'cursor-not-allowed bg-transparent text-text-muted/30'
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container-app py-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted/30 px-6 py-16 text-center">
            <p className="text-lg font-bold text-text">{isAr ? 'لا توجد علامات' : 'No brands found'}</p>
            <p className="mt-2 text-sm text-text-muted">
              {activeLetter && !query
                ? (isAr ? `لا توجد علامات تبدأ بحرف «${activeLetter}»` : `No brands starting with “${activeLetter}”`)
                : (isAr ? 'جرّب كلمة بحث أخرى' : 'Try a different search term')}
            </p>
            {activeLetter && (
              <button
                type="button"
                onClick={() => setLetter(null)}
                className="mt-4 inline-flex rounded-full bg-primary-600 px-4 py-1.5 text-sm font-bold text-white"
              >
                {isAr ? 'عرض كل العلامات' : 'Show all brands'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((brand) => (
              <BrandTile key={brand.slug || brand.query} brand={brand} isAr={isAr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
