import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryLabel, useCategories } from '../../context/CategoriesContext';
import { buildCategoryPath, buildCategorySlugChain } from '../../utils/categoryHelpers';

const MAX_COLUMNS = 4;
const LINKS_PER_COLUMN = 6;

export default function FooterShopDirectory() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories, getChildren, categories } = useCategories();

  const columns = rootCategories.slice(0, MAX_COLUMNS);
  if (!columns.length) return null;

  return (
    <section className="border-b border-slate-700 bg-slate-800/80">
      <div className="container-app py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">
            {isAr ? 'تسوّق حسب القسم' : 'Shop by department'}
          </h2>
          <Link to="/categories" className="text-sm font-medium text-primary-400 hover:text-primary-300">
            {isAr ? 'كل الأقسام' : 'All departments'}
          </Link>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((root) => {
            const children = getChildren(root.slug).slice(0, LINKS_PER_COLUMN);
            const rootHref = buildCategoryPath(buildCategorySlugChain(root, categories));

            return (
              <div key={root.slug || root._id}>
                <Link
                  to={rootHref}
                  className="mb-3 block text-sm font-bold text-white transition-colors hover:text-primary-400"
                >
                  {getCategoryLabel(root, isAr)}
                </Link>
                {children.length > 0 ? (
                  <ul className="space-y-2">
                    {children.map((child) => (
                      <li key={child.slug || child._id}>
                        <Link
                          to={buildCategoryPath(buildCategorySlugChain(child, categories))}
                          className="text-sm text-slate-400 transition-colors hover:text-primary-400"
                        >
                          {getCategoryLabel(child, isAr)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link to={rootHref} className="text-sm text-slate-400 hover:text-primary-400">
                    {isAr ? 'تصفح القسم' : 'Browse section'}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
