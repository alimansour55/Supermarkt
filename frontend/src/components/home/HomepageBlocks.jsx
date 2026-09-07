import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export function HomepageTrustBar({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const items = section.items || [];
  if (!items.length) return null;

  return (
    <section className="container-app py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, i) => {
          const label = isAr ? item.titleAr || item.titleEn : item.titleEn || item.titleAr;
          const inner = (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white px-3 py-4 text-center shadow-sm">
              <span className="text-2xl">{item.emoji || '✓'}</span>
              <span className="text-xs font-bold text-text sm:text-sm">{label}</span>
            </div>
          );
          return item.link ? (
            <Link key={i} to={item.link}>{inner}</Link>
          ) : (
            <div key={i}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

export function HomepageStatsBar({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const items = section.items || [];
  if (!items.length) return null;

  return (
    <section className="container-app py-4">
      <div className="rounded-2xl bg-gradient-to-r from-primary-700 to-primary-900 px-4 py-6 text-white shadow-sm sm:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-extrabold sm:text-3xl">{item.emoji || '—'}</p>
              <p className="mt-1 text-sm font-bold">{isAr ? item.titleAr || item.titleEn : item.titleEn || item.titleAr}</p>
              {(item.query || item.subtitleAr || item.subtitleEn) && (
                <p className="mt-0.5 text-xs text-white/80">
                  {item.query || (isAr ? item.subtitleAr : item.subtitleEn)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomepageFeatureCards({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const items = section.items || [];
  const title = isAr ? section.titleAr : section.titleEn;

  if (!items.length) return null;

  return (
    <section className="container-app py-6">
      {title && <h2 className="mb-4 text-xl font-bold md:text-2xl">{title}</h2>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const label = isAr ? item.titleAr || item.titleEn : item.titleEn || item.titleAr;
          const desc = item.query || (isAr ? item.subtitleAr : item.subtitleEn);
          const card = (
            <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow-md">
              {item.image ? (
                <img src={item.image} alt="" className="mb-3 h-24 w-full rounded-xl object-cover" />
              ) : (
                <span className="mb-3 text-3xl">{item.emoji || '✨'}</span>
              )}
              <h3 className="font-bold text-text">{label}</h3>
              {desc && <p className="mt-2 flex-1 text-sm text-text-muted">{desc}</p>}
            </div>
          );
          return item.link ? (
            <Link key={i} to={item.link}>{card}</Link>
          ) : (
            <div key={i}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}

export function HomepageDualCta({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const items = (section.items || []).slice(0, 2);
  if (!items.length) return null;

  return (
    <section className="container-app py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <Link
            key={i}
            to={item.link || '/products'}
            className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-2xl">
              {item.emoji || '→'}
            </span>
            <div>
              <p className="font-bold text-text">{isAr ? item.titleAr || item.titleEn : item.titleEn || item.titleAr}</p>
              {item.query && <p className="text-sm text-text-muted">{item.query}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
