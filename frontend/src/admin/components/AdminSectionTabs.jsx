import { Link } from '../../app/router';
import { useAdminStats } from '../context/AdminStatsContext';
import { badgeCount } from './AdminSidebar';

/** Tabs for the screens that make up one menu item (Orders → Returns, Invoices…). */
export default function AdminSectionTabs({ tabs, activePath, isAr }) {
  const stats = useAdminStats();

  return (
    <nav
      aria-label={isAr ? 'أقسام الصفحة' : 'Page sections'}
      className="-mb-px flex gap-6 overflow-x-auto scrollbar-none"
    >
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const count = badgeCount(tab, stats);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex shrink-0 items-center gap-2 border-b-2 pb-3 pt-1 text-sm transition-colors',
              active
                ? 'border-primary-600 font-semibold text-text'
                : 'border-transparent text-text-muted hover:text-text',
            ].join(' ')}
          >
            {isAr ? tab.labelAr : tab.labelEn}
            {count > 0 && (
              <span className={[
                'rounded-full px-1.5 text-[11px] font-semibold leading-5',
                active ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-text-muted',
              ].join(' ')}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
