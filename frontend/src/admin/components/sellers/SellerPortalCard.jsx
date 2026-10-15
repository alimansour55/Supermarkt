import { ExternalLink, Settings2 } from 'lucide-react';
import { Link } from '../../../app/router';
import { CopyButton } from '../index';
import { sellerLoginUrl, sellerSignupUrl } from '../../utils/sellerAdmin';

function LinkChip({ title, url, isAr, off, offText }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-white py-1 ps-3 pe-1 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${off ? 'bg-slate-300' : 'bg-emerald-500'}`} title={off ? offText : undefined} />
      <span className="shrink-0 font-semibold text-text">{title}</span>
      <code dir="ltr" className="min-w-0 truncate text-xs text-text-muted">{url.replace(/^https?:\/\//, '')}</code>
      {off && <span className="shrink-0 text-xs text-text-muted">({offText})</span>}
      <CopyButton value={url} isAr={isAr} label={isAr ? 'نسخ الرابط' : 'Copy link'} />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-text"
        title={isAr ? 'فتح' : 'Open'}
        aria-label={isAr ? 'فتح' : 'Open'}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/**
 * The two addresses staff are always asked for — where sellers sign in and where merchants
 * apply — as one compact line, so they are always visible without taking over the page.
 */
export default function SellerPortalCard({ isAr, settings, canEditSettings }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const enabled = settings?.enabled !== false;
  const open = enabled && settings?.registrationOpen !== false;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <LinkChip
        isAr={isAr}
        title={isAr ? 'دخول البائعين' : 'Seller sign-in'}
        url={sellerLoginUrl(origin)}
        off={!enabled}
        offText={isAr ? 'الخدمة متوقفة' : 'marketplace off'}
      />
      <LinkChip
        isAr={isAr}
        title={isAr ? 'طلب الانضمام' : 'Application form'}
        url={sellerSignupUrl(origin, isAr ? 'ar' : 'en')}
        off={!open}
        offText={isAr ? 'مغلق' : 'closed'}
      />
      {canEditSettings && (
        <Link
          to="/admin/marketplace-settings"
          className="rounded-lg p-2 text-text-muted hover:bg-slate-100 hover:text-text"
          title={isAr ? 'إعدادات البيع عن طريق بائعين' : 'Outside sellers settings'}
          aria-label={isAr ? 'الإعدادات' : 'Settings'}
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
