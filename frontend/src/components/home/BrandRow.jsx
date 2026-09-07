import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { fetchBrands } from '../../services/brandApi';
import { SHOP_BRANDS } from '../../data/shopBrands';
import { normalizeBrandRowConfig } from '../../utils/brandRowShared';
import { tileGridClass } from '../../utils/tileGridShared';
import {
  brandProductHref,
  getBrandLabel,
  normalizeBrandEntry,
  resolveBrandRowViewAllLink,
} from '../../utils/shopBrandHelpers';

export default function BrandRow({
  section = {},
  titleAr = 'تسوق حسب الماركة',
  titleEn = 'Shop by Brand',
  link = '/brands',
  icon = '🏷️',
  items = null,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const config = normalizeBrandRowConfig(section.brandRowConfig || {});
  const [catalogBrands, setCatalogBrands] = useState([]);
  const cmsItems = items?.length ? items.map(normalizeBrandEntry) : null;
  const brands = cmsItems?.length
    ? cmsItems
    : (catalogBrands.length ? catalogBrands : SHOP_BRANDS.map(normalizeBrandEntry));
  const resolvedTitleAr = section.titleAr || titleAr;
  const resolvedTitleEn = section.titleEn || titleEn;
  const viewAllLink = resolveBrandRowViewAllLink(section.link || link);
  const resolvedIcon = section.icon || icon;
  const isGrid = config.layout === 'grid';

  useEffect(() => {
    if (cmsItems?.length) return;
    let active = true;
    fetchBrands({ featured: section.brandRowConfig?.featuredOnly ? 'true' : undefined })
      .then((rows) => {
        if (!active) return;
        const normalized = rows.map(normalizeBrandEntry);
        setCatalogBrands(
          section.brandRowConfig?.featuredOnly
            ? normalized.filter((b) => b.isFeatured !== false)
            : normalized,
        );
      });
    return () => { active = false; };
  }, [cmsItems?.length, section.brandRowConfig?.featuredOnly]);

  return (
    <section className="py-6">
      <div className="container-app mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
          {resolvedIcon && <span aria-hidden>{resolvedIcon}</span>}
          {isAr ? resolvedTitleAr : resolvedTitleEn}
        </h2>
        <Link to={viewAllLink} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          {isAr ? 'عرض الكل ←' : 'View All →'}
        </Link>
      </div>
      <div className="container-app">
        <div
          className={
            isGrid
              ? `grid gap-3 ${tileGridClass(config.columns)}`
              : 'flex gap-3 overflow-x-auto pb-2 scrollbar-thin'
          }
        >
          {brands.map((brand) => (
            <Link
              key={brand.slug || brand.query}
              to={brand.link || brandProductHref(brand.query)}
              className={`flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-white px-2 shadow-sm transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98] ${
                isGrid ? 'w-full' : 'w-[100px] shrink-0'
              }`}
            >
              {brand.image ? (
                <img src={brand.image} alt="" className="h-8 w-12 object-contain" loading="lazy" />
              ) : (
                <span className="text-2xl">{brand.emoji}</span>
              )}
              <span className="line-clamp-1 text-center text-[10px] font-bold text-text">
                {getBrandLabel(brand, isAr)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
