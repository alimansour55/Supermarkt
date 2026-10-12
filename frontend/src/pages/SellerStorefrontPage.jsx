import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useParams, useSearchParams } from '../app/router';
import { Clock, MapPin, Star, Store } from 'lucide-react';
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

  const [seller, setSeller] = useState(loaderData.seller || null);
  const [notFound, setNotFound] = useState(Boolean(loaderData.notFound));
  const [products, setProducts] = useState(loaderData.products || null);
  const [pages, setPages] = useState(loaderData.pages || 1);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    if (seller?.slug === slug) return;
    marketplaceApi.getSeller(slug).then(({ data }) => setSeller(data.data)).catch(() => setNotFound(true));
  }, [slug, seller?.slug]);

  useEffect(() => {
    let cancelled = false;
    productService.getAll({ seller: slug, sort, page, limit: 24 })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.data || []);
        setPages(data.pagination?.pages || 1);
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, [slug, sort, page]);

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {isAr ? 'منتجات المتجر' : 'Products'} <span className="text-sm font-normal text-text-muted">({seller.productCount})</span>
        </h2>
        <select
          value={sort}
          onChange={(e) => setSearchParams({ sort: e.target.value })}
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
          aria-label={isAr ? 'ترتيب' : 'Sort'}
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>)}
        </select>
      </div>

      <div className="mt-4">
        {products === null ? (
          <ProductGrid loading layout="cards" />
        ) : products.length ? (
          <ProductGrid products={products} layout="cards" />
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد منتجات معروضة حالياً.' : 'No products listed right now.'}
          </p>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setSearchParams({ sort, page: String(page - 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-border disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setSearchParams({ sort, page: String(page + 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-border disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
        </div>
      )}

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
