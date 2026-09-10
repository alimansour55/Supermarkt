import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/** Small inline "copy to clipboard" button used across the Team console. */
export function CopyButton({ value, isAr, label, className = '' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label || (isAr ? 'نسخ' : 'Copy')}
      aria-label={label || (isAr ? 'نسخ' : 'Copy')}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted transition hover:bg-slate-50 hover:text-text',
        className,
      ].join(' ')}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-600" />
        : <Copy className="h-3.5 w-3.5" />}
      {copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
    </button>
  );
}

function Field({ label, value, isAr, mono = true }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <p
          className={`mt-0.5 truncate font-semibold text-text ${mono ? 'font-mono' : ''}`}
          dir="ltr"
        >
          {value}
        </p>
      </div>
      <CopyButton value={value} isAr={isAr} />
    </div>
  );
}

/**
 * Reveals a team member's sign-in credentials exactly once (on create or password reset).
 * @param {{ username: string, password: string, portal?: 'admin'|'driver', loginPath?: string, isAr: boolean, title?: string }} props
 */
export default function StaffCredentialsCard({
  username,
  password,
  portal = 'admin',
  loginPath,
  isAr,
  title,
}) {
  const path = loginPath || (portal === 'driver' ? '/driver/login' : '/admin/login');
  const loginUrl = `${window.location.origin}${path}`;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-emerald-800">
        <KeyRound className="h-5 w-5" />
        <h3 className="font-semibold">
          {title || (isAr ? 'بيانات الدخول' : 'Sign-in credentials')}
        </h3>
      </div>
      <p className="mb-4 text-sm text-emerald-900/80">
        {isAr
          ? 'انسخ هذه البيانات وأرسلها للعضو عبر قناة خاصة. لن تظهر كلمة المرور مرة أخرى.'
          : 'Copy these and send them to the member over a private channel. The password will not be shown again.'}
      </p>
      <div className="space-y-2">
        <Field label={isAr ? 'اسم المستخدم' : 'Username'} value={username} isAr={isAr} />
        <Field label={isAr ? 'كلمة المرور' : 'Password'} value={password} isAr={isAr} />
        <Field label={isAr ? 'رابط الدخول' : 'Login link'} value={loginUrl} isAr={isAr} mono={false} />
      </div>
    </div>
  );
}
