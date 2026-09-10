import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

/** Full-width tappable search on mobile — opens dedicated search page with autocomplete. */
export default function MobileHeaderSearch() {
  const { t } = useLanguage();

  return (
    <Link
      to="/search"
      className="flex w-full items-center gap-2.5 rounded-full border border-primary-100 bg-primary-50/70 px-5 py-3 text-sm text-primary-400 transition-colors active:bg-primary-50"
      aria-label={t.nav.search}
    >
      <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t.nav.search}</span>
    </Link>
  );
}
