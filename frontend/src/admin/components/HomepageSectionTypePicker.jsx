import { useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  HOMEPAGE_SECTION_CATEGORIES,
  HOMEPAGE_POPULAR_TYPES,
  visibleSectionTypes,
} from '../utils/homepageSectionMeta';

export default function HomepageSectionTypePicker({ onSelect, onClose }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const allTypes = useMemo(() => visibleSectionTypes(), []);
  const totalCount = allTypes.length;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return HOMEPAGE_SECTION_CATEGORIES.map((category) => {
      const types = category.types.filter((t) => {
        if (t.hidden) return false;
        if (activeCategory !== 'all' && category.id !== activeCategory) return false;
        if (!q) return true;
        const hay = [
          t.value,
          t.labelAr,
          t.labelEn,
          t.descriptionAr,
          t.descriptionEn,
          category.labelAr,
          category.labelEn,
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
      return { ...category, types };
    }).filter((c) => c.types.length > 0);
  }, [search, activeCategory]);

  const popularTypes = useMemo(
    () => allTypes.filter((t) => HOMEPAGE_POPULAR_TYPES.includes(t.value)),
    [allTypes],
  );

  const showPopular = !search && activeCategory === 'all';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-border bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-text">
                {isAr ? 'مكتبة أقسام الصفحة الرئيسية' : 'Homepage section library'}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {isAr
                  ? `${totalCount} نوعاً جاهزاً — بانرات، منتجات، ثقة، CTA، محتوى`
                  : `${totalCount} ready-made types — banners, products, trust, CTAs & content`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-text-muted hover:bg-surface-muted"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث: سلايدر، منتجات، نقاط، توصيل...' : 'Search: slider, products, loyalty, delivery...'}
              className="w-full rounded-xl border border-border py-2.5 ps-10 pe-4 text-sm"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <CategoryChip
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              label={isAr ? 'الكل' : 'All'}
            />
            {HOMEPAGE_SECTION_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat.id}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                label={isAr ? cat.labelAr : cat.labelEn}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {showPopular && (
            <section className="mb-8">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {isAr ? 'الأكثر استخداماً' : 'Most popular'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                {popularTypes.map((type) => (
                  <TypeCard key={type.value} type={type} isAr={isAr} onSelect={onSelect} popular />
                ))}
              </div>
            </section>
          )}

          {filteredCategories.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">
              {isAr ? 'لا نتائج — جرّب كلمة أخرى' : 'No matches — try another search term'}
            </p>
          ) : activeCategory === 'all' ? (
            filteredCategories.map((category) => (
              <section key={category.id} className="mb-8 last:mb-0">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
                  {isAr ? category.labelAr : category.labelEn}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                  {category.types.map((type) => (
                    <TypeCard
                      key={type.value}
                      type={type}
                      isAr={isAr}
                      onSelect={onSelect}
                      categoryId={category.id}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
              {filteredCategories.flatMap((category) => category.types.map((type) => (
                <TypeCard
                  key={type.value}
                  type={type}
                  isAr={isAr}
                  onSelect={onSelect}
                  categoryId={category.id}
                />
              )))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'border border-border bg-white text-text-muted hover:border-primary-200'
      }`}
    >
      {label}
    </button>
  );
}

const CATEGORY_ACCENTS = {
  banners: 'hover:border-orange-300 hover:bg-orange-50/50',
  browse: 'hover:border-blue-300 hover:bg-blue-50/50',
  products: 'hover:border-emerald-300 hover:bg-emerald-50/50',
  social: 'hover:border-violet-300 hover:bg-violet-50/50',
  utility: 'hover:border-slate-400 hover:bg-slate-50',
  cta: 'hover:border-pink-300 hover:bg-pink-50/50',
  content: 'hover:border-amber-300 hover:bg-amber-50/50',
};

function TypeCard({ type, isAr, onSelect, popular = false, categoryId = '' }) {
  const accent = CATEGORY_ACCENTS[categoryId] || 'hover:border-primary-300 hover:bg-primary-50/40';

  return (
    <button
      type="button"
      onClick={() => onSelect(type.value)}
      className={`group relative flex min-h-[128px] flex-col items-start gap-2 rounded-xl border border-border bg-white p-4 text-start transition hover:shadow-md ${accent}`}
    >
      {popular && (
        <span className="absolute end-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          {isAr ? 'شائع' : 'Popular'}
        </span>
      )}
      <span className="text-2xl" aria-hidden>{type.icon}</span>
      <span className="pe-8 font-bold text-text">{isAr ? type.labelAr : type.labelEn}</span>
      <span className="line-clamp-2 text-xs leading-relaxed text-text-muted">
        {isAr ? type.descriptionAr : type.descriptionEn}
      </span>
    </button>
  );
}
