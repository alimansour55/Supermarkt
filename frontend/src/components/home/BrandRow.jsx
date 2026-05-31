import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { SHOP_BRANDS } from '../../data/shopBrands';

export default function BrandRow() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <section className="py-6">
      <div className="container-app mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
          <span aria-hidden>🏷️</span>
          {isAr ? 'تسوق حسب الماركة' : 'Shop by Brand'}
        </h2>
        <Link to="/products" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          {isAr ? 'عرض الكل ←' : 'View All →'}
        </Link>
      </div>
      <div className="container-app">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {SHOP_BRANDS.map((brand) => (
            <Link
              key={brand.slug}
              to={`/products?brand=${encodeURIComponent(brand.query)}`}
              className="flex h-[72px] w-[100px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-white px-2 shadow-sm transition-all hover:border-primary-200 hover:shadow-md active:scale-[0.98]"
            >
              <span className="text-2xl">{brand.emoji}</span>
              <span className="line-clamp-1 text-center text-[10px] font-bold text-text">
                {isAr ? brand.nameAr : brand.nameEn}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
