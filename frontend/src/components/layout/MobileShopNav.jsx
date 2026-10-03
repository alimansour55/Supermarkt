import { useMemo, useState } from 'react';
import { Link } from '../../app/router';
import { ChevronDown, Home, Link2, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getCategoryLabel, useCategories } from '../../context/CategoriesContext';
import { buildStoreNavItems, filterNavItemsForMobile } from '../../utils/navBarConfig';
import { buildCategoryPath, buildCategorySlugChain } from '../../utils/categoryHelpers';
import CategoryImage from '../category/CategoryImage';

function MobileCategoryTree({ rootSlug, onClose, isAr }) {
  const { getChildren, categories } = useCategories();
  const root = categories.find((cat) => cat.slug === rootSlug);
  const children = getChildren(rootSlug);

  if (!root) return null;

  return (
    <div className="ms-2 mt-1 space-y-1 border-s-2 border-primary-100 ps-3">
      <Link
        to={buildCategoryPath(buildCategorySlugChain(root, categories))}
        onClick={onClose}
        className="block rounded-lg px-2 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
      >
        {isAr ? `كل ${getCategoryLabel(root, isAr)}` : `All ${getCategoryLabel(root, isAr)}`}
      </Link>
      {children.map((child) => {
        const grandchildren = getChildren(child.slug);
        const childHref = buildCategoryPath(buildCategorySlugChain(child, categories));
        return (
          <div key={child.slug || child._id}>
            <Link
              to={childHref}
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text hover:bg-surface"
            >
              <CategoryImage category={child} size="xs" />
              <span className="flex-1">{getCategoryLabel(child, isAr)}</span>
            </Link>
            {grandchildren.length > 0 && (
              <div className="ms-4 space-y-0.5 border-s border-border ps-2">
                {grandchildren.map((grand) => (
                  <Link
                    key={grand.slug || grand._id}
                    to={buildCategoryPath(buildCategorySlugChain(grand, categories))}
                    onClick={onClose}
                    className="block rounded-md px-2 py-1.5 text-xs text-text-muted hover:bg-primary-50 hover:text-primary-800"
                  >
                    {getCategoryLabel(grand, isAr)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MobileShopNav({ onClose }) {
  const { language } = useLanguage();
  const { settings } = useStoreSettings();
  const { categories, getChildren, rootCategories } = useCategories();
  const isAr = language === 'ar';
  const [homeOpen, setHomeOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);

  const navItems = useMemo(
    () => filterNavItemsForMobile(
      buildStoreNavItems(settings?.navigation, categories, getChildren),
    ),
    [settings?.navigation, categories, getChildren],
  );

  if (!navItems.length) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-text-muted">
        {isAr ? 'تسوق' : 'Shop'}
      </h3>
      <nav className="space-y-0.5">
        {navItems.map((item) => {
          const label = isAr ? item.labelAr : item.labelEn;

          if (item.type === 'home') {
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setHomeOpen((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-text transition-colors hover:bg-surface"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <Home className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-start">{label}</span>
                  <ChevronDown className={`h-5 w-5 text-text-muted transition-transform ${homeOpen ? 'rotate-180' : ''}`} />
                </button>
                {homeOpen && (
                  <div className="mb-2 space-y-2 px-3">
                    <Link
                      to="/categories"
                      onClick={onClose}
                      className="block rounded-lg bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800"
                    >
                      {isAr ? 'عرض كل الأقسام' : 'View all departments'}
                    </Link>
                    {rootCategories.map((root) => (
                      <MobileCategoryTree
                        key={root.slug}
                        rootSlug={root.slug}
                        onClose={onClose}
                        isAr={isAr}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (item.type === 'category' && item.hasMegaMenu) {
            const isOpen = openCategory === item.slug;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenCategory(isOpen ? null : item.slug)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-text transition-colors hover:bg-surface"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Tag className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-start">{label}</span>
                  <ChevronDown className={`h-5 w-5 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mb-2 px-3">
                    <MobileCategoryTree rootSlug={item.slug} onClose={onClose} isAr={isAr} />
                  </div>
                )}
              </div>
            );
          }

          const highlight = item.highlight;
          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold transition-colors hover:bg-surface ${
                highlight ? 'text-accent-600' : 'text-text'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                highlight ? 'bg-amber-50 text-accent-600' : item.type === 'category' ? 'bg-amber-50 text-amber-700' : 'bg-surface text-primary-700'
              }`}>
                {item.type === 'category' ? <Tag className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
