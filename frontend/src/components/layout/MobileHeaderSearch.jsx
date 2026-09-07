import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

/** Full-width tappable search on mobile — opens dedicated search page with autocomplete. */
export default function MobileHeaderSearch() {
  const { t } = useLanguage();

  return (
    <Link
      to="/search"
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/80 px-4 py-3.5 text-sm text-text-muted shadow-sm transition-colors active:bg-surface hover:border-primary-200"
      aria-label={t.nav.search}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
        <Search className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{t.nav.search}</span>
    </Link>
  );
}
