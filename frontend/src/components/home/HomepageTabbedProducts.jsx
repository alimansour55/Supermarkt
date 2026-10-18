import { useId, useState } from 'react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import ProductGrid from '../product/ProductGrid';
import { ShopIconBadge } from '../ui/ShopIcon';

/** One block, several product lists behind tabs (Best sellers / New / Offers…). */
export default function HomepageTabbedProducts({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const baseId = useId();
  const tabs = (section.productTabs || []).filter((tab) => tab.products?.length);
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;

  const current = tabs[Math.min(active, tabs.length - 1)];
  const cfg = section.blockConfig || {};
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const tabLabel = (tab) => (isAr ? tab.labelAr || tab.labelEn : tab.labelEn || tab.labelAr);

  const onKeyDown = (event) => {
    const step = { ArrowRight: isAr ? -1 : 1, ArrowLeft: isAr ? 1 : -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <section className="container-app py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {title && (
            <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
              <ShopIconBadge name={section.icon} />
              {title}
            </h2>
          )}
        </div>
        {current.link && (
          <Link to={current.link} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            {isAr ? 'عرض الكل' : 'View all'}
          </Link>
        )}
      </div>
      <div role="tablist" aria-label={title || undefined} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0" onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={`${tabLabel(tab)}-${index}`}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selected ? 'border-primary-600 bg-primary-600 text-white shadow-sm' : 'border-border bg-white text-text hover:border-primary-300'
              }`}
            >
              {tabLabel(tab)}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${active}`}>
        <ProductGrid
          products={current.products}
          layout={cfg.layout === 'grid' ? 'grid' : 'scroll'}
          columns={Number(cfg.columns) || 4}
        />
      </div>
    </section>
  );
}
