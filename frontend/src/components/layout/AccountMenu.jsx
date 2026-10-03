import { Link } from '../../app/router';
import { User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function AccountMenu({ className = '', showLabel = true }) {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  const to = isAuthenticated ? '/profile' : '/login';
  const label = isAuthenticated
    ? (user?.name?.split(' ')[0] || t.nav.account)
    : t.nav.signInRegister;

  return (
    <Link
      to={to}
      className={`flex min-h-[44px] items-center gap-2 rounded-field px-2 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 ${className}`}
    >
      <User className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className={showLabel ? 'hidden max-w-[150px] truncate leading-tight lg:inline' : 'sr-only'}>
        {label}
      </span>
    </Link>
  );
}
