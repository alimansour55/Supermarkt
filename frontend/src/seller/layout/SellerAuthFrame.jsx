import { Store } from 'lucide-react';

/** Shared frame for the seller sign-in, 2-step, forgot and reset screens. */
export default function SellerAuthFrame({ isAr, icon: Icon = Store, title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4 py-12" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-300">{footer}</div>}
      </div>
    </div>
  );
}

