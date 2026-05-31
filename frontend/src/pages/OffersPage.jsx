import { useLanguage } from '../context/LanguageContext';
import { fetchOffers } from '../services/productApi';
import { useAsyncData } from '../hooks/useAsyncData';
import ProductGrid from '../components/product/ProductGrid';
import PromoBanners from '../components/home/PromoBanners';
import Loader from '../components/ui/Loader';

export default function OffersPage() {
  const { language } = useLanguage();
  const { data: offers, loading } = useAsyncData(fetchOffers, []);

  return (
    <div>
      <div className="bg-gradient-to-l from-red-500 via-orange-500 to-amber-500 py-10 text-white">
        <div className="container-app">
          <h1 className="text-3xl font-extrabold md:text-4xl">
            {language === 'ar' ? '🔥 عروض متتفوتش' : '🔥 Unmissable Offers'}
          </h1>
          <p className="mt-2 text-white/90">
            {language === 'ar' ? 'خصومات حصرية على أفضل المنتجات' : 'Exclusive discounts on top products'}
          </p>
        </div>
      </div>
      <PromoBanners />
      <div className="container-app pb-10">
        {loading ? (
          <div className="flex justify-center py-20"><Loader size="lg" /></div>
        ) : (
          <>
            <p className="mb-6 text-sm text-text-muted">{(offers || []).length} {language === 'ar' ? 'عرض' : 'offers'}</p>
            <ProductGrid products={offers || []} />
          </>
        )}
      </div>
    </div>
  );
}
