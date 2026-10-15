import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useParams, useSearchParams } from '../app/router';
import {
  BadgeCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, MapPin, MessageSquareText, Package,
  Search, Share2, ShoppingBag, SlidersHorizontal, Sparkles, Star, Store, Tag, X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import ProductCard from '../components/product/ProductCard';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import Loader from '../components/ui/Loader';
import { productService } from '../services/apiServices';
import { marketplaceApi } from '../services/sellerApi';

const SORTS = [
  { value: 'best-selling', ar: 'الأكثر مبيعاً', en: 'Best selling' },
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'price-asc', ar: 'السعر: من الأقل', en: 'Price: low to high' },
  { value: 'price-desc', ar: 'السعر: من الأعلى', en: 'Price: high to low' },
];

const PAGE_SIZE = 24;
const REVIEWS_PAGE = 6;
/** Small catalogues get a full-width grid and inline filters instead of a sidebar. */
const SIDEBAR_MIN_PRODUCTS = 12;

const fmtNumber = (n, isAr) => Number(n || 0).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-US');

function Stars({ rating, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= Math.round(rating) ? 'fill-current' : 'text-slate-300'}`} />)}
    </span>
  );
}

/** Logo, or the store's first letter on a tinted tile when it has none. */
function StoreLogo({ seller, name }) {
  if (seller.logoUrl) return <img src={seller.logoUrl} alt="" className="h-full w-full object-cover" />;
  // "العندليب" → "ع": the Arabic article would make every monogram an alif.
  const letter = (name || '').trim().replace(/^ال(?=\S{2,})/, '').charAt(0).toUpperCase();
  return (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-4xl font-extrabold text-primary-700">
      {letter || <Store className="h-10 w-10" />}
    </span>
  );
}

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-text">{value}</p>
        <p className="truncate text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Copies the store link (or opens the phone's share sheet). */
function ShareButton({ name, isAr }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split('?')[0];
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* share sheet dismissed */ }
  };
  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold hover:bg-slate-50">
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
      {copied ? (isAr ? 'تم نسخ الرابط' : 'Link copied') : (isAr ? 'مشاركة المتجر' : 'Share store')}
    </button>
  );
}

/** The seller's banner slider: auto-advances every 5 s, dots to jump, pauses on hover. */
function BannerSlider({ banners, isAr }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (banners.length < 2 || paused) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length, paused]);
  const current = banners[Math.min(index, banners.length - 1)];
  const img = <img src={current.url} alt="" className="h-full w-full object-cover" />;
  return (
    <section className="relative mt-6 aspect-[16/5] overflow-hidden rounded-3xl bg-slate-100 shadow-sm" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {current.link ? <a href={current.link} className="block h-full">{img}</a> : img}
      {banners.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button key={b.url} type="button" onClick={() => setIndex(i)} aria-label={isAr ? `الشريحة ${i + 1}` : `Slide ${i + 1}`} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/60'}`} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Page numbers with the current one centred: 1 … 4 5 6 … 12. */
function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]));
}

function Pagination({ page, pages, onChange, isAr }) {
  if (pages <= 1) return null;
  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;
  const btn = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm ring-1 ring-border disabled:opacity-40';
  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label={isAr ? 'الصفحات' : 'Pages'}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={btn} aria-label={isAr ? 'السابق' : 'Previous'}><Prev className="h-4 w-4" /></button>
      {pageList(page, pages).map((p, i) => (p === '…'
        ? <span key={`gap-${i}`} className="px-1 text-text-muted">…</span>
        : (
          <button key={p} type="button" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined} className={`${btn} ${p === page ? 'bg-primary-600 font-semibold text-white ring-primary-600' : 'bg-white hover:bg-slate-50'}`}>
            {p}
          </button>
        )))}
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className={btn} aria-label={isAr ? 'التالي' : 'Next'}><Next className="h-4 w-4" /></button>
    </nav>
  );
}

/** Rating summary (average + 5→1 bars) and the latest reviews, with "show more". */
function ReviewsSection({ slug, seller, isAr }) {
  const [state, setState] = useState({ items: null, distribution: [], page: 1, pages: 1, loading: false });

  const load = (page) => {
    setState((s) => ({ ...s, loading: true }));
    marketplaceApi.getReviews(slug, { limit: REVIEWS_PAGE, page })
      .then(({ data }) => setState((s) => ({
        items: page === 1 ? data.data || [] : [...(s.items || []), ...(data.data || [])],
        distribution: data.distribution || s.distribution,
        page,
        pages: data.pagination?.pages || 1,
        loading: false,
      })))
      .catch(() => setState((s) => ({ ...s, items: s.items || [], loading: false })));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1); }, [slug]);

  const total = seller.ratingCount || 0;
  return (
    <section id="reviews" className="mt-8 scroll-mt-32 rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold">{isAr ? 'تقييمات العملاء' : 'Customer reviews'}</h2>
      {total === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-5 text-sm text-text-muted">
          <MessageSquareText className="h-6 w-6 shrink-0 text-slate-400" aria-hidden />
          <p>{isAr ? 'لا توجد تقييمات بعد. يستطيع العملاء تقييم المتجر بعد استلام طلباتهم.' : 'No reviews yet. Customers can rate this store after their order is delivered.'}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-4xl font-extrabold">{seller.rating.toFixed(1)}<span className="text-base font-medium text-text-muted"> / 5</span></p>
            <div className="mt-1"><Stars rating={seller.rating} size="h-5 w-5" /></div>
            <p className="mt-1 text-xs text-text-muted">{isAr ? `من ${fmtNumber(total, isAr)} تقييم` : `Based on ${fmtNumber(total, isAr)} review(s)`}</p>
            <ul className="mt-4 space-y-1.5">
              {state.distribution.map((d) => {
                const pct = total ? Math.round((d.count / total) * 100) : 0;
                return (
                  <li key={d.rating} className="flex items-center gap-2 text-xs">
                    <span className="flex w-7 items-center gap-0.5 font-semibold">{d.rating}<Star className="h-3 w-3 fill-amber-500 text-amber-500" /></span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} /></span>
                    <span className="w-9 text-end text-text-muted">{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            {state.items === null ? (
              <Loader />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {state.items.map((r) => (
                  <li key={r._id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">{(r.userName || '?').charAt(0)}</span>
                        <span className="text-sm font-semibold">{r.userName}</span>
                      </div>
                      <span className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB')}</span>
                    </div>
                    <div className="mt-2"><Stars rating={r.rating} /></div>
                    {r.comment && <p className="mt-1.5 text-sm leading-relaxed">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
            {state.page < state.pages && (
              <button type="button" disabled={state.loading} onClick={() => load(state.page + 1)} className="mt-4 w-full rounded-xl border border-border py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                {isAr ? 'عرض المزيد من التقييمات' : 'Show more reviews'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Public store page of a marketplace seller: profile, stats, products, reviews and about. */
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
  const offers = searchParams.get('offers') === 'true';
  const filtersKey = searchParams.toString();

  const [seller, setSeller] = useState(loaderData.seller || null);
  const [notFound, setNotFound] = useState(Boolean(loaderData.notFound));
  const [products, setProducts] = useState(loaderData.products || null);
  const [pages, setPages] = useState(loaderData.pages || 1);
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
  const goToPage = (p) => {
    update({ page: p > 1 ? String(p) : '' });
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      limit: PAGE_SIZE,
      sellerCategory: section || undefined,
      q: q || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      inStock: inStock ? 'true' : undefined,
      offers: offers ? 'true' : undefined,
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

  const joined = useMemo(() => (seller?.joinedAt
    ? new Date(seller.joinedAt).toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' })
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
    offers && { key: 'offers', label: isAr ? 'العروض فقط' : 'Deals only', clear: { offers: '' } },
  ].filter(Boolean);
  const about = isAr ? seller.descriptionAr || seller.descriptionEn : seller.descriptionEn || seller.descriptionAr;
  const tagline = isAr ? seller.storefront?.taglineAr || seller.storefront?.taglineEn : seller.storefront?.taglineEn || seller.storefront?.taglineAr;
  const featured = seller.featuredProducts || [];
  const showFeatured = featured.length > 0 && !chips.length && page === 1;
  const showSidebar = sections.length > 0 || seller.productCount >= SIDEBAR_MIN_PRODUCTS;
  const hasRating = seller.ratingCount > 0;
  const shipLabel = seller.handlingDays === 0
    ? (isAr ? 'يشحن في نفس اليوم' : 'Ships same day')
    : (isAr ? `يشحن خلال ${seller.handlingDays} يوم` : `Ships within ${seller.handlingDays} day(s)`);
  const gridClass = showSidebar
    ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  const stats = [
    { icon: Star, value: hasRating ? `${seller.rating.toFixed(1)} / 5` : (isAr ? 'بائع جديد' : 'New seller'), label: hasRating ? (isAr ? `${fmtNumber(seller.ratingCount, isAr)} تقييم` : `${fmtNumber(seller.ratingCount, isAr)} review(s)`) : (isAr ? 'لا تقييمات بعد' : 'No reviews yet') },
    { icon: Package, value: fmtNumber(seller.productCount, isAr), label: isAr ? 'منتج معروض' : 'Products' },
    seller.soldCount > 0 && { icon: ShoppingBag, value: `${fmtNumber(seller.soldCount, isAr)}+`, label: isAr ? 'قطعة مباعة' : 'Items sold' },
    {
      icon: Clock,
      value: seller.handlingDays === 0 ? (isAr ? 'نفس اليوم' : 'Same day') : (isAr ? `${seller.handlingDays} يوم` : `${seller.handlingDays} day(s)`),
      label: isAr ? 'مدة التجهيز' : 'Ships within',
    },
    joined && { icon: CalendarDays, value: joined, label: isAr ? 'عضو منذ' : 'Member since' },
  ].filter(Boolean);

  const tabs = [
    { id: 'products', label: isAr ? 'المنتجات' : 'Products', count: seller.productCount },
    { id: 'reviews', label: isAr ? 'التقييمات' : 'Reviews', count: seller.ratingCount },
    { id: 'about', label: isAr ? 'عن المتجر' : 'About' },
  ];

  const quickToggle = (on, onClick, Icon, label) => (
    <button type="button" onClick={onClick} aria-pressed={on} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 ${on ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white ring-border hover:bg-slate-50'}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );

  return (
    <div className="container-app py-6">
      {/* ── Store header ── */}
      <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        <div className={`relative bg-gradient-to-br from-primary-700 via-primary-600 to-slate-900 ${seller.bannerUrl ? 'h-36 sm:h-56' : 'h-28 sm:h-36'}`}>
          {seller.bannerUrl ? (
            <img src={seller.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" aria-hidden />
        </div>

        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative z-10 -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md sm:-mt-14 sm:h-28 sm:w-28">
              <StoreLogo seller={seller} name={name} />
            </div>
            <div className="min-w-0 flex-1 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" />{isAr ? 'بائع معتمد' : 'Approved seller'}
                </span>
              </div>
              {tagline && <p className="mt-1 text-sm font-medium text-primary-700">{tagline}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                {hasRating && (
                  <a href="#reviews" className="flex items-center gap-1.5 hover:text-text"><Stars rating={seller.rating} /> <span className="font-semibold text-text">{seller.rating.toFixed(1)}</span> ({fmtNumber(seller.ratingCount, isAr)})</a>
                )}
                {seller.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{seller.city}</span>}
              </div>
            </div>
            <div className="sm:pb-1"><ShareButton name={name} isAr={isAr} /></div>
          </div>

          <div className={`mt-5 grid grid-cols-2 gap-2 ${stats.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            {stats.map((s) => <StatTile key={s.label} {...s} />)}
          </div>
        </div>

        {seller.vacation && (
          <div className="flex items-start gap-3 border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 sm:px-6">
            <span aria-hidden>🌴</span>
            <p>
              <span className="font-semibold">{isAr ? 'المتجر في إجازة' : 'This store is on a break'}</span>
              {seller.vacation.until && (isAr
                ? ` — يعود ${new Date(seller.vacation.until).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' })}`
                : ` — back ${new Date(seller.vacation.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`)}
              {(isAr ? seller.vacation.messageAr : seller.vacation.messageEn) && <span className="block">{isAr ? seller.vacation.messageAr : seller.vacation.messageEn}</span>}
            </p>
          </div>
        )}

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 sm:px-4" aria-label={isAr ? 'أقسام الصفحة' : 'Page sections'}>
          {tabs.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-text-muted hover:border-primary-600 hover:text-primary-700">
              {t.label}
              {t.count > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium">{fmtNumber(t.count, isAr)}</span>}
            </a>
          ))}
        </nav>
      </section>

      {seller.storefront?.banners?.length > 0 && <BannerSlider banners={seller.storefront.banners} isAr={isAr} />}

      {showFeatured && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-amber-500" />{isAr ? 'مختارات المتجر' : 'Featured by the store'}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {featured.map((p) => <ProductCard key={String(p._id || p.slug)} product={p} />)}
          </div>
        </section>
      )}

      {/* ── Products ── */}
      <div id="products" className={`mt-8 scroll-mt-32 ${showSidebar ? 'grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start' : ''}`}>
        {showSidebar && (
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
          </aside>
        )}

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
            <div className="flex flex-wrap items-center gap-2">
              {seller.offerCount > 0 && quickToggle(offers, () => update({ offers: offers ? '' : 'true' }), Tag, isAr ? `العروض (${seller.offerCount})` : `Deals (${seller.offerCount})`)}
              {quickToggle(inStock, () => update({ inStock: inStock ? '' : 'true' }), Check, isAr ? 'المتوفر فقط' : 'In stock')}
              {showSidebar && (
                <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm lg:hidden">
                  <SlidersHorizontal className="h-4 w-4" />{isAr ? 'فلاتر' : 'Filters'}
                </button>
              )}
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'best-selling' ? '' : e.target.value })}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                aria-label={isAr ? 'ترتيب' : 'Sort'}
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <h2 className="text-lg font-bold">
              {activeSection ? (isAr ? activeSection.nameAr : activeSection.nameEn) : (isAr ? 'كل المنتجات' : 'All products')}
              {total != null && <span className="ms-1.5 text-sm font-normal text-text-muted">({fmtNumber(total, isAr)})</span>}
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
              <ProductGridSkeleton count={8} layout="cards" columns={4} />
            ) : products.length ? (
              <div className={`grid gap-2 sm:gap-3 ${gridClass}`}>
                {products.map((p) => <ProductCard key={String(p._id || p.slug)} product={p} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
                <p className="mt-3 text-sm text-text-muted">
                  {chips.length
                    ? (isAr ? 'لا توجد منتجات تطابق اختيارك.' : 'No products match your filters.')
                    : (isAr ? 'لا توجد منتجات معروضة حالياً.' : 'No products listed right now.')}
                </p>
                {chips.length > 0 && (
                  <button type="button" onClick={() => setSearchParams({})} className="mt-3 text-sm font-semibold text-primary-700 hover:underline">
                    {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                  </button>
                )}
              </div>
            )}
          </div>

          <Pagination page={page} pages={pages} onChange={goToPage} isAr={isAr} />
        </div>
      </div>

      <ReviewsSection slug={slug} seller={seller} isAr={isAr} />

      {/* ── About ── */}
      <section id="about" className="mt-8 scroll-mt-32 rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">{isAr ? `عن ${name}` : `About ${name}`}</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
            {about || (isAr ? `${name} بائع على منصتنا. تصفح منتجاته واطلب وسيصلك طلبك حتى باب بيتك.` : `${name} sells on our marketplace. Browse the products and we'll deliver your order to your door.`)}
          </p>
          <ul className="space-y-2.5 text-sm">
            {seller.city && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-text-muted" />{isAr ? `يشحن من ${seller.city}` : `Ships from ${seller.city}`}</li>}
            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-text-muted" />{shipLabel}</li>
            {joined && <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-text-muted" />{isAr ? `على المنصة منذ ${joined}` : `Selling here since ${joined}`}</li>}
            <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-600" />{isAr ? 'تمت مراجعة المتجر والموافقة عليه' : 'Store reviewed and approved'}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
