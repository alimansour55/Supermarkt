import HeroSlider from '../components/home/HeroSlider';
import HomeFreeDeliveryBanner from '../components/home/HomeFreeDeliveryBanner';
import HomeBrowseHub from '../components/home/HomeBrowseHub';
import TodaysDealsSection from '../components/home/TodaysDealsSection';
import ProductSection from '../components/home/ProductSection';
import BrandRow from '../components/home/BrandRow';
import HomeDeliveryBar from '../components/home/HomeDeliveryBar';
import HomepageSectionRenderer from '../components/home/HomepageSectionRenderer';
import { fetchBestSellers, fetchNewArrivals } from '../services/productApi';
import { useHomepageSections } from '../hooks/useHomepageSections';
import { useAsyncData } from '../hooks/useAsyncData';
import useIsMobile from '../hooks/useIsMobile';
import { HomePageSkeleton } from '../components/ui/Skeleton';

function BestSellersFallback() {
  const { data: products, loading } = useAsyncData(() => fetchBestSellers(8), []);
  return (
    <ProductSection
      titleAr="الأكثر مبيعاً"
      titleEn="Best Sellers"
      icon="⭐"
      products={products || []}
      link="/products?section=best-sellers&sort=best-selling"
      loading={loading}
    />
  );
}

function NewArrivalsFallback() {
  const { data: products, loading } = useAsyncData(() => fetchNewArrivals(8), []);
  return (
    <ProductSection
      titleAr="وصل حديثاً"
      titleEn="New Arrivals"
      icon="🆕"
      products={products || []}
      link="/products?section=new-arrivals&sort=newest"
      loading={loading}
    />
  );
}

function FallbackHome() {
  return (
    <div className="pb-10">
      <HeroSlider />
      <HomeFreeDeliveryBanner />
      <HomeBrowseHub />
      <div className="container-app">
        <TodaysDealsSection />
        <BestSellersFallback />
        <NewArrivalsFallback />
      </div>
      <BrandRow />
      <HomeDeliveryBar />
    </div>
  );
}

function CmsHomeContent({ sections }) {
  const isMobile = useIsMobile();
  const visibleSections = sections.filter((s) => !isMobile || s.showOnMobile !== false);

  return (
    <>
      {visibleSections.map((section) => (
        <HomepageSectionRenderer key={section._id} section={section} />
      ))}
    </>
  );
}

export default function HomePage() {
  const { sections, loading } = useHomepageSections();

  if (sections?.length) {
    return (
      <div className="pb-10">
        <CmsHomeContent sections={sections} />
      </div>
    );
  }

  if (loading) return <HomePageSkeleton />;

  return <FallbackHome />;
}
