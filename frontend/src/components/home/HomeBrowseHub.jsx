import { Link } from 'react-router-dom';
import { ChevronLeft, LayoutGrid, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCategories } from '../../context/CategoriesContext';
import {
  getAllSubcategories,
  categoryLabel,
  categoryHref,
  filterSubcategoryLabel,
} from '../../utils/categoryHelpers';
import CategoryImage from '../category/CategoryImage';
import { normalizeBrowseConfig } from '../../utils/browseHubShared';

const HUB_HEADER_CLASS =
  'group mb-2.5 flex h-10 shrink-0 items-center gap-2 rounded-lg sm:mb-3 sm:h-11';

function NavChevron({ isAr, className = '' }) {
  return (
    <ChevronLeft
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isAr ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5 rotate-180'} ${className}`}
      aria-hidden
    />
  );
}

function BrowseHubHeader({ to, icon: Icon, title, isAr, iconClassName = 'bg-surface text-primary-700 ring-1 ring-border' }) {
  return (
    <Link to={to} className={`${HUB_HEADER_CLASS} transition-colors hover:bg-surface`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ${iconClassName}`}>
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-text sm:text-[13px]">{title}</span>
      <NavChevron isAr={isAr} className="text-text-muted group-hover:text-primary-600" />
    </Link>
  );
}

function AllProductsTile({ isAr, section, link }) {
  const copy = isAr
    ? {
        title: section?.titleAr || 'كل المنتجات',
        headline: section?.titleAr || 'المتجر كامل بين يديك',
        detail: section?.subtitleAr || 'ماركات مفضّلة، عروض يومية، وأسعار واضحة',
        cta: section?.ctaLabelAr || 'تسوّق الآن',
      }
    : {
        title: section?.titleEn || 'All products',
        headline: section?.titleEn || 'The whole store, one tap away',
        detail: section?.subtitleEn || 'Top brands, daily deals, clear prices',
        cta: section?.ctaLabelEn || 'Shop now',
      };

  return (
    <div className="flex min-h-0 w-full flex-col md:h-full md:border-e md:border-border/60">
      <Link to={link} className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-primary-50/40 md:hidden" aria-label={copy.title}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
          <ShoppingBag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-text">{copy.title}</span>
          <span className="block truncate text-xs text-text-muted">{copy.detail}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white">
          {copy.cta}
          <NavChevron isAr={isAr} className="h-3 w-3 text-white/90" />
        </span>
      </Link>

      <div className="hidden min-h-0 flex-1 flex-col p-2.5 sm:p-3 md:flex">
        <BrowseHubHeader to={link} icon={ShoppingBag} title={copy.title} isAr={isAr} iconClassName="bg-primary-600 text-white" />
        <Link to={link} className="group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 via-white to-emerald-50/50 ring-1 ring-primary-100/80 transition-all duration-200 hover:shadow-md hover:ring-primary-200" aria-label={copy.title}>
          <span className="pointer-events-none absolute -end-6 -top-8 h-24 w-24 rounded-full bg-primary-200/40 blur-2xl transition-opacity duration-200 group-hover:opacity-80" aria-hidden />
          <span className="pointer-events-none absolute -start-8 -bottom-10 h-28 w-28 rounded-full bg-emerald-200/30 blur-2xl" aria-hidden />
          <div className="relative z-10 flex min-h-[5.5rem] flex-1 flex-col items-center justify-center gap-2 p-2.5 text-center sm:min-h-[6rem] sm:p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-[0_6px_16px_-4px_rgba(5,150,105,0.5)] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
              <ShoppingBag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <p className="text-[11px] font-extrabold leading-snug text-primary-900 sm:text-xs">{copy.headline}</p>
            <p className="line-clamp-2 px-0.5 text-[10px] leading-snug text-text-muted">{copy.detail}</p>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-all duration-200 group-hover:gap-1.5 group-hover:bg-primary-700">
              {copy.cta}
              <NavChevron isAr={isAr} className="h-2.5 w-2.5 text-white/90" />
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function SubcategoryOrb({ sub, isAr, categories }) {
  return (
    <Link
      to={categoryHref(sub, null, null, categories)}
      className="group flex w-[3.25rem] shrink-0 flex-col items-center gap-1 transition-transform active:scale-95 md:w-16 md:gap-1.5"
      title={filterSubcategoryLabel(sub, isAr)}
    >
      <span className="rounded-full p-0.5 ring-2 ring-transparent transition-all group-hover:ring-primary-200">
        <CategoryImage category={sub} size="xs" className="!h-10 !w-10 !rounded-full shadow-sm ring-1 ring-black/[0.04] transition-transform duration-200 group-hover:scale-105 md:!h-12 md:!w-12" />
      </span>
      <span className="w-full truncate text-center text-[9px] font-semibold leading-tight text-text md:text-[10px]">
        {filterSubcategoryLabel(sub, isAr)}
      </span>
    </Link>
  );
}

function SubcategoriesTile({ isAr, loading, preview, hasMore, categories, link, count }) {
  const title = isAr ? 'الأقسام الفرعية' : 'Subcategories';
  return (
    <div className="flex min-h-0 min-w-0 flex-col p-2.5 sm:p-3 md:h-full">
      <BrowseHubHeader to={link} icon={LayoutGrid} title={title} isAr={isAr} />
      <div className="flex min-h-[5.5rem] flex-1 items-start gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-thin sm:min-h-[6rem]" aria-label={title}>
        {loading ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1 md:w-14" aria-hidden>
              <span className="h-10 w-10 animate-pulse rounded-full bg-border/70 md:h-12 md:w-12" />
            </div>
          ))
        ) : preview.length > 0 ? (
          <>
            {preview.slice(0, count).map((sub) => (
              <SubcategoryOrb key={`${sub.rootSlug || sub.parentSlug}-${sub.slug}`} sub={sub} isAr={isAr} categories={categories} />
            ))}
            {hasMore && (
              <Link to={link} className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1 md:w-16">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-primary-300 bg-primary-50 text-primary-700 md:h-12 md:w-12">
                  <LayoutGrid className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden />
                </span>
                <span className="text-center text-[9px] font-bold text-primary-700 md:text-[10px]">{isAr ? 'المزيد' : 'More'}</span>
              </Link>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SubcategoriesBanner({ section, isAr, config, preview, total, link }) {
  const title = isAr ? (section?.titleAr || 'تصفّح الأقسام الفرعية') : (section?.titleEn || 'Browse all subcategories');
  const subtitle = isAr
    ? (section?.subtitleAr || `كل العلامات والأنواع — ${total} قسم فرعي`)
    : (section?.subtitleEn || `All brands and types — ${total} subcategories`);

  return (
    <section className="container-app py-4">
      <Link to={link} className="group flex flex-col gap-4 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm">
            <LayoutGrid className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text md:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:max-w-[50%] sm:justify-end">
          {preview.slice(0, config.subcategoryCount).map((sub) => (
            <span key={`${sub.parentSlug}-${sub.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-text shadow-sm">
              <CategoryImage category={sub} size="xs" className="!h-6 !w-6 !rounded-full" />
              <span className="max-w-[88px] truncate">{categoryLabel(sub, isAr)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white">
            {isAr ? 'عرض الكل' : 'View all'}
            <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
}

export default function HomeBrowseHub({ section = {} }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { categoryTree, categories, loading } = useCategories();
  const config = normalizeBrowseConfig(section.browseConfig || {});
  const subs = getAllSubcategories(categoryTree, categories);
  const preview = subs.slice(0, config.subcategoryCount);
  const hasMore = subs.length > preview.length;
  const productsLink = config.productsLink || '/products';
  const subcategoriesLink = config.subcategoriesLink || '/subcategories';

  if (config.variant === 'banner') {
    if (loading || !subs.length) return null;
    return (
      <SubcategoriesBanner
        section={section}
        isAr={isAr}
        config={config}
        preview={subs}
        total={subs.length}
        link={subcategoriesLink}
      />
    );
  }

  if (config.variant === 'products') {
    return (
      <section className="container-app py-2 md:py-4" aria-label={isAr ? 'تصفح المتجر' : 'Browse store'}>
        <div className="rounded-2xl border border-border bg-white p-1.5 shadow-sm md:p-2">
          <AllProductsTile isAr={isAr} section={section} link={productsLink} />
        </div>
      </section>
    );
  }

  if (config.variant === 'subcategories') {
    return (
      <section className="container-app py-2 md:py-4" aria-label={isAr ? 'تصفح المتجر' : 'Browse store'}>
        <div className="rounded-2xl border border-border bg-white p-1.5 shadow-sm md:p-2">
          <SubcategoriesTile isAr={isAr} loading={loading} preview={preview} hasMore={hasMore} categories={categories} link={subcategoriesLink} count={config.subcategoryCount} />
        </div>
      </section>
    );
  }

  const showProducts = config.showProducts !== false;
  const showSubcategories = config.showSubcategories !== false;

  return (
    <section className="container-app py-2 md:py-4" aria-label={isAr ? 'تصفح المتجر' : 'Browse store'}>
      <div className="rounded-2xl border border-border bg-white p-1.5 shadow-sm md:p-2">
        <div className={`flex flex-col overflow-hidden rounded-xl ${showProducts && showSubcategories ? 'md:grid md:min-h-[10.5rem] md:grid-cols-2 md:items-stretch' : ''}`}>
          {showSubcategories && (
            <div className={showProducts ? 'order-1 md:order-2' : ''}>
              <SubcategoriesTile isAr={isAr} loading={loading} preview={preview} hasMore={hasMore} categories={categories} link={subcategoriesLink} count={config.subcategoryCount} />
            </div>
          )}
          {showProducts && (
            <div className={`${showSubcategories ? 'order-2 border-t border-border/60 md:order-1 md:border-t-0' : ''}`}>
              <AllProductsTile isAr={isAr} section={section} link={productsLink} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
