import { useLanguage } from '../context/LanguageContext';
import RecurringSubscriptionManager from '../components/account/RecurringSubscriptionManager';

export default function RecurringDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="min-w-0">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">
        {isAr ? 'التوصيل الدوري' : 'Recurring delivery'}
      </h1>
      <RecurringSubscriptionManager isAr={isAr} />
    </div>
  );
}
