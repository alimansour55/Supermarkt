import HeroSlider from '../components/home/HeroSlider';
import HomeFreeDeliveryBanner from '../components/home/HomeFreeDeliveryBanner';
import CategoriesScroll from '../components/home/CategoriesScroll';
import TodaysDealsSection from '../components/home/TodaysDealsSection';
import ProductSection from '../components/home/ProductSection';
import BrandRow from '../components/home/BrandRow';
import HomeDeliveryBar from '../components/home/HomeDeliveryBar';
import { fetchBestSellers, fetchNewArrivals } from '../services/productApi';
import { useAsyncData } from '../hooks/useAsyncData';

function BestSellersSection() {
  const { data: products, loading } = useAsyncData(() => fetchBestSellers(8), []);
  return (
    <ProductSection
      titleAr="الأكثر مبيعاً"
      titleEn="Best Sellers"
      icon="⭐"
      products={products || []}
      link="/products?sort=best-selling"
      loading={loading}
    />
  );
}

function NewArrivalsSection() {
  const { data: products, loading } = useAsyncData(() => fetchNewArrivals(8), []);
  return (
    <ProductSection
      titleAr="وصل حديثاً"
      titleEn="New Arrivals"
      icon="🆕"
      products={products || []}
      link="/products?sort=newest"
      loading={loading}
    />
  );
}

export default function HomePage() {
  return (
    <div className="pb-10">
      <HeroSlider />
      <HomeFreeDeliveryBanner />
      <CategoriesScroll />
      <div className="container-app">
        <TodaysDealsSection />
        <BestSellersSection />
        <NewArrivalsSection />
      </div>
      <BrandRow />
      <HomeDeliveryBar />
    </div>
  );
}
