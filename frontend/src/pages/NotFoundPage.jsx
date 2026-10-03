import { Link } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="text-8xl font-extrabold text-primary-200">404</span>
      <h1 className="mt-4 text-2xl font-bold text-text">{t.common.notFound}</h1>
      <Link to="/" className="mt-8">
        <Button>{t.common.backHome}</Button>
      </Link>
    </div>
  );
}
