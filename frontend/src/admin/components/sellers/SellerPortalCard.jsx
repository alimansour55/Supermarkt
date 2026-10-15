import { ExternalLink, LogIn, Settings2, Store, UserPlus } from 'lucide-react';
import { Link } from '../../../app/router';
import { CopyButton } from '../index';
import { sellerLoginUrl, sellerSignupUrl } from '../../utils/sellerAdmin';

function LinkRow({ icon: Icon, title, hint, url, isAr, badge }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-text">{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
        <div className="mt-2 flex min-w-0 items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
          <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-slate-700">{url}</code>
          <CopyButton value={url} isAr={isAr} label={isAr ? 'نسخ الرابط' : 'Copy link'} />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-text"
            title={isAr ? 'فتح في نافذة جديدة' : 'Open in a new tab'}
            aria-label={isAr ? 'فتح' : 'Open'}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The two addresses staff are always asked for: where sellers sign in, and where new
 * merchants apply. Shown at the top of the Sellers page so nobody has to guess them.
 */
export default function SellerPortalCard({ isAr, settings, canEditSettings }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const enabled = settings?.enabled !== false;
  const open = enabled && settings?.registrationOpen !== false;

  const chip = (on, onText, offText) => (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {on ? onText : offText}
    </span>
  );

  return (
    <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/70 to-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary-700" />
          <h2 className="text-sm font-bold text-text">{isAr ? 'روابط البائعين' : 'Seller links'}</h2>
        </div>
        {canEditSettings && (
          <Link to="/admin/marketplace-settings" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
            <Settings2 className="h-3.5 w-3.5" />
            {isAr ? 'إعدادات البيع عن طريق بائعين' : 'Outside sellers settings'}
          </Link>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <LinkRow
          icon={LogIn}
          isAr={isAr}
          title={isAr ? 'دخول البائعين (مركز البائعين)' : 'Seller sign-in (Seller Center)'}
          hint={isAr ? 'أرسل هذا الرابط للبائع بعد اعتماده ليدير منتجاته وطلباته.' : 'Send this to approved sellers — it is where they manage products and orders.'}
          url={sellerLoginUrl(origin)}
          badge={chip(enabled, isAr ? 'يعمل' : 'Live', isAr ? 'الخدمة متوقفة' : 'Marketplace off')}
        />
        <LinkRow
          icon={UserPlus}
          isAr={isAr}
          title={isAr ? 'طلب الانضمام كبائع' : 'Seller application form'}
          hint={isAr ? 'صفحة عامة يملأها التاجر ليطلب البيع في متجرك. يظهر رابطها في أسفل المتجر.' : 'Public page where merchants apply to sell. Linked from the store footer.'}
          url={sellerSignupUrl(origin, isAr ? 'ar' : 'en')}
          badge={chip(open, isAr ? 'التسجيل مفتوح' : 'Open for applications', isAr ? 'التسجيل مغلق' : 'Applications closed')}
        />
      </div>
    </section>
  );
}
