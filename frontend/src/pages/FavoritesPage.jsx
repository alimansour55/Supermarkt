import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import { fetchProductsPaginated } from '../services/productApi';
import { PRODUCTS } from '../data/mockData';
import { useAsyncData } from '../hooks/useAsyncData';
import ProductGrid from '../components/product/ProductGrid';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';

export default function FavoritesPage() {
  const { language } = useLanguage();
  const { favorites } = useFavorites();
  const isAr = language === 'ar';

  const { data: products, loading } = useAsyncData(async () => {
    if (!favorites.length) return [];
    const res = await fetchProductsPaginated({ page: 1, limit: 200 });
    const matched = (res.data || []).filter((p) => favorites.includes(p._id));
    const missing = favorites.filter((id) => !matched.some((p) => p._id === id));
    const fromMock = PRODUCTS.filter((p) => missing.includes(p._id));
    return [...matched, ...fromMock];
  }, [favorites.join(',')]);

  return (
    <div className="container-app py-6">
      <h1 className="mb-6 text-2xl font-bold">{isAr ? 'المفضلة' : 'Favorites'}</h1>

      {loading && <ProductGridSkeleton count={6} />}

      {!loading && favorites.length === 0 && (
        <div className="py-20 text-center text-text-muted">
          <Heart className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
          <p className="mt-4">{isAr ? 'لا توجد منتجات في المفضلة' : 'No favorites yet'}</p>
          <Link to="/products" className="mt-4 inline-block text-primary-600">
            {isAr ? 'تصفح المنتجات' : 'Browse products'}
          </Link>
        </div>
      )}

      {!loading && favorites.length > 0 && (
        <>
          {products?.length === 0 ? (
            <p className="text-sm text-text-muted">
              {isAr ? 'المنتجات المحفوظة غير متوفرة حالياً' : 'Saved products are unavailable'}
            </p>
          ) : (
            <ProductGrid products={products} />
          )}
        </>
      )}
    </div>
  );
}
