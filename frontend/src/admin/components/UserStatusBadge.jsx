import { Ban, CircleCheck, Clock } from 'lucide-react';

/**
 * Account status pill. Reused by the users table and the user detail panel.
 * - suspended: isActive === false
 * - pending: active but phone not yet verified
 * - active: active + verified
 */
export function resolveUserStatus(user) {
  if (!user) return 'active';
  if (user.isActive === false) return 'suspended';
  if (!user.isPhoneVerified) return 'pending';
  return 'active';
}

const STATUS_META = {
  active: {
    icon: CircleCheck,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    en: 'Active',
    ar: 'نشط',
  },
  pending: {
    icon: Clock,
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
    en: 'Unverified',
    ar: 'غير موثّق',
  },
  suspended: {
    icon: Ban,
    className: 'bg-red-50 text-red-700 ring-red-200',
    en: 'Suspended',
    ar: 'موقوف',
  },
};

export default function UserStatusBadge({ user, status, isAr, className = '' }) {
  const key = status || resolveUserStatus(user);
  const meta = STATUS_META[key] || STATUS_META.active;
  const Icon = meta.icon;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        meta.className,
        className,
      ].join(' ')}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {isAr ? meta.ar : meta.en}
    </span>
  );
}
