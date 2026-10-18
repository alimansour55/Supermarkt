import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import ShopIcon, { ShopIconBadge } from '../ui/ShopIcon';

const ACCENTS = {
  primary: 'from-primary-50 to-white border-primary-100 text-primary-900',
  emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-900',
  sky: 'from-sky-50 to-white border-sky-100 text-sky-900',
  amber: 'from-amber-50 to-white border-amber-100 text-amber-900',
  rose: 'from-rose-50 to-white border-rose-100 text-rose-900',
  violet: 'from-violet-50 to-white border-violet-100 text-violet-900',
  slate: 'from-slate-100 to-white border-slate-200 text-slate-900',
};

const COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };

/** "Shop by occasion" — tiles like Ramadan, school, BBQ night, each opening a page. */
export default function HomepageOccasionTiles({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const cfg = section.blockConfig || {};
  const tiles = cfg.tiles || [];
  if (!tiles.length) return null;
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const scroll = cfg.layout === 'scroll';
  const cols = COLS[Math.min(4, Math.max(2, Number(cfg.columns) || 4))];

  return (
    <section className="container-app py-6">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
              <ShopIconBadge name={section.icon} />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
      )}
      <div className={scroll ? 'flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin' : `grid grid-cols-2 gap-3 ${cols}`}>
        {tiles.map((tile, index) => {
          const name = isAr ? tile.titleAr || tile.titleEn : tile.titleEn || tile.titleAr;
          const line = isAr ? tile.subtitleAr || tile.subtitleEn : tile.subtitleEn || tile.subtitleAr;
          return (
            <Link
              key={`${name}-${index}`}
              to={tile.link || '/products'}
              className={`group relative flex min-h-[7rem] overflow-hidden rounded-2xl border bg-gradient-to-br shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                ACCENTS[tile.accent] || ACCENTS.primary
              } ${scroll ? 'w-40 shrink-0 snap-start sm:w-48' : ''}`}
            >
              {tile.image ? (
                <>
                  <img src={tile.image} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <span className="relative mt-auto p-3 text-white">
                    <span className="block text-sm font-bold sm:text-base">{name}</span>
                    {line && <span className="block text-xs text-white/85">{line}</span>}
                  </span>
                </>
              ) : (
                <span className="flex w-full flex-col justify-between gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                    <ShopIcon name={tile.icon} fallback="gift" className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold sm:text-base">{name}</span>
                    {line && <span className="block text-xs opacity-75">{line}</span>}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
