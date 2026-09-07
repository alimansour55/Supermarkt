import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductGrid from '../components/product/ProductGrid';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';

export default function FavoritesPage() {
  const { language } = useLanguage();
  const { favorites, favoriteProducts, loading } = useFavorites();
  const isAr = language === 'ar';

  const products = useMemo(() => {
    const map = new Map(favoriteProducts.map((product) => [String(product._id), product]));
    return favorites.map((id) => map.get(String(id))).filter(Boolean);
  }, [favoriteProducts, favorites]);

  return (
    <div className="container-app py-6 pb-24 md:pb-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isAr ? 'المفضلة' : 'Favorites'}</h1>
            {!loading && favorites.length > 0 && (
              <p className="text-sm text-text-muted">
                {isAr
                  ? `${favorites.length} ${favorites.length === 1 ? 'منتج' : 'منتجات'}`
                  : `${favorites.length} ${favorites.length === 1 ? 'item' : 'items'}`}
              </p>
            )}
          </div>
        </div>
        {!loading && favorites.length > 0 && (
          <Link to="/products" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            {isAr ? 'تصفح المزيد' : 'Browse more'}
          </Link>
        )}
      </div>

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
          {products.length === 0 ? (
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
