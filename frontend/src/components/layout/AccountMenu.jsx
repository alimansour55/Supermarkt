import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function AccountMenu({ className = '' }) {
  const { t, language } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-surface transition-colors ${className}`}
      >
        <User className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{t.nav.login}</span>
      </Link>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-surface transition-colors min-h-[44px]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <User className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline max-w-[80px] truncate">
          {user?.name?.split(' ')[0] || t.nav.account}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-white py-2 shadow-xl">
          <Link to="/profile" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-primary-50">
            {t.nav.account}
          </Link>
          <Link to="/orders" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-primary-50">
            {language === 'ar' ? 'طلباتي' : 'My Orders'}
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            className="block w-full px-4 py-3 text-start text-sm text-red-600 hover:bg-red-50"
          >
            {t.nav.logout}
          </button>
        </div>
      )}
    </div>
  );
}
