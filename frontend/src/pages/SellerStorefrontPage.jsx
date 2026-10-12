import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useParams, useSearchParams } from '../app/router';
import { Clock, MapPin, Search, SlidersHorizontal, Star, Store, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import ProductGrid from '../components/product/ProductGrid';
import Loader from '../components/ui/Loader';
import { productService } from '../services/apiServices';
import { marketplaceApi } from '../services/sellerApi';

const SORTS = [
  { value: 'best-selling', ar: 'الأكثر مبيعاً', en: 'Best selling' },
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'price-asc', ar: 'السعر: من الأقل', en: 'Price: low to high' },
  { value: 'price-desc', ar: 'السعر: من الأعلى', en: 'Price: high to low' },
];

function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= Math.round(rating) ? 'fill-current' : ''}`} />)}
    </span>
  );
}

/** Public store page of a marketplace seller: profile, rating, reviews and products. */
export default function SellerStorefrontPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const loaderData = useLoaderData() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') || 'best-selling';
  const page = Number(searchParams.get('page')) || 1;
  const section = searchParams.get('section') || '';
  const q = searchParams.get('q') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';
  const filtersKey = searchParams.toString();

  const [seller, setSeller] = useState(loaderData.seller || null);
  const [notFound, setNotFound] = useState(Boolean(loaderData.notFound));
  const [products, setProducts] = useState(loaderData.products || null);
  const [pages, setPages] = useState(loaderData.pages || 1);
  const [reviews, setReviews] = useState(null);
  const [sections, setSections] = useState(loaderData.sections || []);
  const [total, setTotal] = useState(loaderData.total ?? null);
  const [search, setSearch] = useState(q);
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** Change some params; anything but `page` itself resets to page 1. */
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    if (seller?.slug === slug) return;
    marketplaceApi.getSeller(slug).then(({ data }) => setSeller(data.data)).catch(() => setNotFound(true));
  }, [slug, seller?.slug]);

  useEffect(() => {
    let cancelled = false;
    productService.getAll({
      seller: slug,
      sort,
      page,
      limit: 24,
      sellerCategory: section || undefined,
      q: q || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStock ? 'true' : undefined,
    })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.data || []);
        setPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total ?? null);
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
    // filtersKey covers every query param read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, filtersKey]);

  useEffect(() => {
    marketplaceApi.getCategories(slug).then(({ data }) => setSections(data.data || [])).catch(() => setSections([]));
  }, [slug]);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => { setPriceDraft({ min: minPrice, max: maxPrice }); }, [minPrice, maxPrice]);

  useEffect(() => {
    marketplaceApi.getReviews(slug, { limit: 6 }).then(({ data }) => setReviews(data)).catch(() => setReviews(null));
  }, [slug]);

  const joined = useMemo(() => (seller?.joinedAt
    ? new Date(seller.joinedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })
    : ''), [seller?.joinedAt, isAr]);

  if (notFound) {
    return (
      <div className="container-app py-20 text-center">
        <Store className="mx-auto h-12 w-12 text-slate-300" aria-hidden />
        <p className="mt-4 text-lg font-bold">{isAr ? 'هذا المتجر غير متاح' : 'This store is not available'}</p>
      </div>
    );
  }
  if (!seller) return <div className="flex min-h-[50vh] items-center justify-center"><Loader size="lg" /></div>;

  const name = isAr ? seller.nameAr || seller.nameEn : seller.nameEn || seller.nameAr;
  const activeSection = sections.find((c) => c.slug === section);
  const chips = [
    activeSection && { key: 'section', label: isAr ? activeSection.nameAr : activeSection.nameEn, clear: { section: '' } },
    q && { key: 'q', label: `"${q}"`, clear: { q: '' } },
    (minPrice || maxPrice) && { key: 'price', label: `${minPrice || 0} – ${maxPrice || '∞'} ${isAr ? 'ج.م' : 'EGP'}`, clear: { minPrice: '', maxPrice: '' } },
    inStock && { key: 'stock', label: isAr ? 'المتوفر فقط' : 'In stock', clear: { inStock: '' } },
  ].filter(Boolean);
  const about = isAr ? seller.descriptionAr || seller.descriptionEn : seller.descriptionEn || seller.descriptionAr;

  return (
    <div className="container-app py-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        <div className="h-32 bg-gradient-to-br from-indigo-600 to-slate-800 sm:h-44">
          {seller.bannerUrl && <img src={seller.bannerUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="-mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow sm:-mt-16">
            {seller.logoUrl
              ? <img src={seller.logoUrl} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center bg-indigo-50 text-indigo-600"><Store className="h-10 w-10" /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
              {seller.ratingCount > 0 ? (
                <span className="flex items-center gap-1.5"><Stars rating={seller.rating} /> {seller.rating.toFixed(1)} ({seller.ratingCount})</span>
              ) : (
                <span>{isAr ? 'بائع جديد' : 'New seller'}</span>
              )}
              {seller.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{seller.city}</span>}
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{isAr ? `يشحن خلال ${seller.handlingDays} يوم` : `Ships within ${seller.handlingDays} day(s)`}</span>
              {joined && <span>{isAr ? `منذ ${joined}` : `Since ${joined}`}</span>}
            </div>
          </div>
        </div>
        {about && <p className="whitespace-pre-line border-t border-border px-5 py-4 text-sm text-text-muted">{about}</p>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} space-y-5 rounded-2xl border border-border bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:block`}>
          {sections.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold">{isAr ? 'أقسام المتجر' : 'Store sections'}</p>
              <ul className="space-y-0.5">
                <li>
                  <button type="button" onClick={() => update({ section: '' })} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-sm ${!section ? 'bg-primary-50 font-semibold text-primary-700' : 'hover:bg-slate-50'}`}>
                    {isAr ? 'كل المنتجات' : 'All products'}
                    <span className="text-xs text-text-muted">{seller.productCount}</span>
                  </button>
                </li>
                {sections.map((c) => {
                  const on = section === c.slug;
                  return (
                    <li key={c._id}>
                      <button type="button" onClick={() => update({ section: on ? '' : c.slug })} className={`flex w-full items-center justify-between rounded-lg py-1.5 text-start text-sm ${c.parent ? 'pe-2.5 ps-6' : 'px-2.5'} ${on ? 'bg-primary-50 font-semibold text-primary-700' : 'hover:bg-slate-50'}`}>
                        <span className="truncate">{isAr ? c.nameAr : c.nameEn}</span>
                        {c.productCount > 0 && <span className="text-xs text-text-muted">{c.productCount}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); update({ minPrice: priceDraft.min, maxPrice: priceDraft.max }); }}>
            <p className="mb-2 text-sm font-bold">{isAr ? 'السعر (ج.م)' : 'Price (EGP)'}</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" inputMode="numeric" value={priceDraft.min} onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))} placeholder={isAr ? 'من' : 'Min'} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm" dir="ltr" />
              <span className="text-text-muted">–</span>
              <input type="number" min="0" inputMode="numeric" value={priceDraft.max} onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))} placeholder={isAr ? 'إلى' : 'Max'} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm" dir="ltr" />
            </div>
            <button type="submit" className="mt-2 w-full rounded-lg bg-slate-900 py-1.5 text-sm font-semibold text-white">{isAr ? 'تطبيق' : 'Apply'}</button>
          </form>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })} className="h-4 w-4 rounded" />
            {isAr ? 'المتوفر فقط' : 'In stock only'}
          </label>
        </aside>

        <div className="min-w-0">
          {sections.length > 0 && (
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
              <button type="button" onClick={() => update({ section: '' })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${!section ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white ring-border'}`}>
                {isAr ? 'الكل' : 'All'}
              </button>
              {sections.filter((c) => !c.parent).map((c) => (
                <button key={c._id} type="button" onClick={() => update({ section: section === c.slug ? '' : c.slug })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${section === c.slug ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white ring-border'}`}>
                  {isAr ? c.nameAr : c.nameEn}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }} className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? `ابحث في ${name}` : `Search ${name}`}
                className="w-full rounded-xl border border-border bg-white py-2 pe-3 ps-9 text-sm"
              />
            </form>
            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />{isAr ? 'فلاتر' : 'Filters'}
            </button>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'best-selling' ? '' : e.target.value })}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              aria-label={isAr ? 'ترتيب' : 'Sort'}
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>)}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <h2 className="font-bold">
              {activeSection ? (isAr ? activeSection.nameAr : activeSection.nameEn) : (isAr ? 'منتجات المتجر' : 'Products')}
              {total != null && <span className="ms-1 text-sm font-normal text-text-muted">({total})</span>}
            </h2>
            {chips.map((chip) => (
              <button key={chip.key} type="button" onClick={() => update(chip.clear)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium hover:bg-slate-200">
                {chip.label}<X className="h-3 w-3" />
              </button>
            ))}
            {chips.length > 1 && (
              <button type="button" onClick={() => setSearchParams(sort !== 'best-selling' ? { sort } : {})} className="text-xs font-semibold text-primary-700 hover:underline">
                {isAr ? 'مسح الكل' : 'Clear all'}
              </button>
            )}
          </div>

          <div className="mt-4">
            {products === null ? (
              <ProductGrid loading layout="cards" />
            ) : products.length ? (
              <ProductGrid products={products} layout="cards" />
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
                {chips.length
                  ? (isAr ? 'لا توجد منتجات تطابق اختيارك.' : 'No products match your filters.')
                  : (isAr ? 'لا توجد منتجات معروضة حالياً.' : 'No products listed right now.')}
              </p>
            )}
          </div>

          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-border disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-border disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
            </div>
          )}
        </div>
      </div>

      {reviews?.data?.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{isAr ? 'آراء العملاء في البائع' : 'What customers say'}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {reviews.data.map((r) => (
              <li key={r._id} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                <p className="mt-2 text-xs font-semibold text-text-muted">{r.userName}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
