import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import RecurringSubscriptionManager from '../components/account/RecurringSubscriptionManager';

export default function RecurringDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="container-app py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link to="/" className="hover:text-primary-600">{isAr ? 'الرئيسية' : 'Home'}</Link>
        {' / '}
        <Link to="/profile" className="hover:text-primary-600">{isAr ? 'حسابي' : 'Account'}</Link>
        {' / '}
        <span>{isAr ? 'التوصيل الدوري' : 'Recurring delivery'}</span>
      </nav>

      <RecurringSubscriptionManager isAr={isAr} />
    </div>
  );
}
