import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { loyaltyService } from '../services/apiServices';
import Loader from '../components/ui/Loader';
import LoyaltyPointsPanel from '../components/account/LoyaltyPointsPanel';

export default function MyPointsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loyaltyService.getMe(language)
      .then(({ data }) => {
        if (mounted) setLoyalty(data);
      })
      .catch(() => {
        if (mounted) setLoyalty(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [language]);

  return (
    <div className="container-app py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link to="/" className="hover:text-primary-600">{isAr ? 'الرئيسية' : 'Home'}</Link>
        {' / '}
        <Link to="/profile" className="hover:text-primary-600">{isAr ? 'حسابي' : 'Account'}</Link>
        {' / '}
        <span>{isAr ? 'نقاطي' : 'My Points'}</span>
      </nav>

      <h1 className="mb-8 text-2xl font-bold md:text-3xl">{isAr ? 'نقاطي' : 'My Points'}</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : (
        <div className="max-w-2xl">
          <LoyaltyPointsPanel isAr={isAr} loyalty={loyalty} user={user} showAllHistory />
        </div>
      )}
    </div>
  );
}
