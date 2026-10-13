import { useEffect, useState } from 'react';
import { Link, useLocation } from '../../app/router';
import { ChevronDown, ExternalLink, PanelLeftClose, PanelLeftOpen, Store, X } from 'lucide-react';
import { navItemActive } from '../sellerNav';

const TONES = {
  red: 'bg-red-500 text-white',
  amber: 'bg-amber-400 text-amber-950',
  indigo: 'bg-indigo-500 text-white',
};

function Badge({ value, tone = 'red', collapsed }) {
  if (!value) return null;
  const text = value > 99 ? '99+' : value;
  if (collapsed) return <span className={`absolute end-1.5 top-1.5 h-2 w-2 rounded-full ${TONES[tone] || TONES.red}`} aria-label={String(text)} />;
  return <span className={`ms-auto min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${TONES[tone] || TONES.red}`}>{text}</span>;
}

/**
 * Seller Center menu. Desktop: fixed on the start side (right in Arabic), collapsible to icons.
 * Mobile: a drawer opened from the top bar.
 */
export default function SellerSidebar({ nav, summary, isAr, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, seller }) {
  const location = useLocation();
  const groupActive = (g) => (g.children || []).some((c) => navItemActive(c, location));
  const [open, setOpen] = useState(() => new Set(nav.filter(groupActive).map((g) => g.id)));

  // Opening a page from elsewhere (dashboard link, search) expands its group.
  useEffect(() => {
    const active = nav.find(groupActive);
    if (active) setOpen((prev) => (prev.has(active.id) ? prev : new Set([...prev, active.id])));
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const label = (i) => (isAr ? i.ar : i.en);
  const groupBadge = (g) => (g.children || []).reduce((n, c) => n + (c.badge && c.badgeTone === 'red' ? summary?.[c.badge] || 0 : 0), 0);
  const narrow = collapsed && !mobileOpen;

  const linkCls = (active, nested) => [
    'relative flex items-center gap-3 rounded-xl text-sm transition',
    narrow ? 'justify-center px-0 py-2.5' : nested ? 'py-2 pe-3 ps-10' : 'px-3 py-2.5',
    active ? 'bg-indigo-600 font-semibold text-white shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white',
  ].join(' ');

  const storeUrl = seller?.slug && seller.status === 'active' ? `/${isAr ? 'ar' : 'en'}/sellers/${seller.slug}` : null;
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={onCloseMobile} aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'} />}
      <aside
        className={[
          'fixed inset-y-0 start-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-200',
          mobileOpen ? 'w-72 translate-x-0' : `${isAr ? 'translate-x-full' : '-translate-x-full'} lg:translate-x-0`,
          narrow ? 'lg:w-[4.5rem]' : 'lg:w-64',
        ].join(' ')}
        aria-label={isAr ? 'قائمة مركز البائعين' : 'Seller Center menu'}
      >
        <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/10 ${narrow ? 'justify-center px-2' : 'px-4'}`}>
          <Link to="/seller-center" className="flex min-w-0 items-center gap-2.5">
            {seller?.logoUrl
              ? <img src={seller.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/20" />
              : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500"><Store className="h-5 w-5" aria-hidden /></span>}
            {!narrow && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{seller ? (isAr ? seller.nameAr : seller.nameEn) : ''}</span>
                <span className="block text-[11px] text-slate-400">{isAr ? 'مركز البائعين' : 'Seller Center'}</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={onCloseMobile} className="ms-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label={isAr ? 'إغلاق' : 'Close'}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 [scrollbar-width:thin]">
          {nav.map((item) => {
            if (!item.children) {
              const active = navItemActive(item, location);
              return (
                <Link key={item.id} to={item.to} className={linkCls(active)} title={narrow ? label(item) : undefined} aria-current={active ? 'page' : undefined}>
                  <item.Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {!narrow && <span className="truncate">{label(item)}</span>}
                  {item.badge && <Badge value={summary?.[item.badge]} tone={item.badgeTone} collapsed={narrow} />}
                </Link>
              );
            }
            const expanded = open.has(item.id) && !narrow;
            const active = groupActive(item);
            const pending = groupBadge(item);
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => (narrow ? onToggleCollapsed() : toggle(item.id))}
                  title={narrow ? label(item) : undefined}
                  aria-expanded={expanded}
                  className={[
                    'relative flex w-full items-center gap-3 rounded-xl text-sm transition',
                    narrow ? 'justify-center py-2.5' : 'px-3 py-2.5',
                    active ? 'font-semibold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                    narrow && active ? 'bg-indigo-600' : '',
                  ].join(' ')}
                >
                  <item.Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {!narrow && <span className="truncate">{label(item)}</span>}
                  {!expanded && pending > 0 && <Badge value={pending} collapsed={narrow} />}
                  {!narrow && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${expanded ? 'rotate-180' : ''} ${!expanded && pending ? '' : 'ms-auto'}`} aria-hidden />}
                </button>
                {expanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((c) => {
                      const on = navItemActive(c, location);
                      return (
                        <Link key={c.to} to={c.to} className={linkCls(on, true)} aria-current={on ? 'page' : undefined}>
                          <span className="truncate">{label(c)}</span>
                          {c.badge && <Badge value={summary?.[c.badge]} tone={c.badgeTone} />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/10 p-2">
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noreferrer" className={linkCls(false)} title={narrow ? (isAr ? 'عرض متجري' : 'View my store') : undefined}>
              <ExternalLink className="h-5 w-5 shrink-0" aria-hidden />
              {!narrow && <span>{isAr ? 'عرض متجري للعملاء' : 'View my storefront'}</span>}
            </a>
          )}
          <button type="button" onClick={onToggleCollapsed} className={`hidden w-full lg:flex ${linkCls(false)}`} title={isAr ? 'طي / توسيع القائمة' : 'Collapse / expand menu'}>
            <CollapseIcon className={`h-5 w-5 shrink-0 ${isAr ? 'scale-x-[-1]' : ''}`} aria-hidden />
            {!narrow && <span>{isAr ? 'طي القائمة' : 'Collapse menu'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
