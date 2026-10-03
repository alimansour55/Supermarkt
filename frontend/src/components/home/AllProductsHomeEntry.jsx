import { Link } from '../../app/router';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function AllProductsHomeEntry() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <section className="container-app py-4">
      <Link
        to="/products"
        className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm">
            <ShoppingBag className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text md:text-xl">
              {isAr ? 'تصفح كل المنتجات' : 'Browse all products'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr
                ? 'فلترة حسب القسم الرئيسي والفرعي، الماركة، السعر والمزيد'
                : 'Filter by main & sub category, brand, price, and more'}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors group-hover:bg-primary-700">
          {isAr ? 'عرض الكل' : 'Shop all'}
          <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
        </span>
      </Link>
    </section>
  );
}
