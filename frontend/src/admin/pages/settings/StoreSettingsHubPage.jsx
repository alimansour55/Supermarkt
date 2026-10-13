import { Link } from '../../../app/router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { useAdminPanel } from '../../context/AdminPanelContext';
import useAdminNav from '../../hooks/useAdminNav';

function FeatureState({ on, isAr }) {
  if (on === undefined) return null;
  return (
    <span
      className={[
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
        on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-text-muted',
      ].join(' ')}
    >
      {on ? (isAr ? 'شغّال' : 'On') : (isAr ? 'متوقف' : 'Off')}
    </span>
  );
}

export default function StoreSettingsHubPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { features } = useAdminPanel();
  const { settings } = useAdminNav();
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {settings.map((group) => (
        <section key={group.id}>
          <h2 className="mb-1 px-1 text-sm font-semibold text-text">
            {isAr ? group.labelAr : group.labelEn}
          </h2>
          {(group.hintAr || group.hintEn) && (
            <p className="mb-2 px-1 text-sm text-text-muted">{isAr ? group.hintAr : group.hintEn}</p>
          )}
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {group.items.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{isAr ? item.labelAr : item.labelEn}</p>
                    <p className="mt-0.5 text-sm text-text-muted">{isAr ? item.descAr : item.descEn}</p>
                  </div>
                  {item.feature && <FeatureState on={features[item.feature]} isAr={isAr} />}
                  <Chevron className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
