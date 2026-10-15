import { useLoaderData } from '../app/router';
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
import useHomepageViewer from '../hooks/useHomepageViewer';
import HomepageSectionShell from '../components/home/HomepageSectionShell';
import { sectionVisibleTo } from '../utils/homepageVisibility';
import { HomePageSkeleton } from '../components/ui/Skeleton';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { useLanguage } from '../context/LanguageContext';

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
  const viewer = useHomepageViewer();
  // Device rules are CSS (inside the shell), so phones get the right HTML from the server.
  const visibleSections = sections.filter((section) => sectionVisibleTo(section, viewer));

  return (
    <>
      {visibleSections.map((section) => (
        <HomepageSectionShell key={section._id} section={section}>
          <HomepageSectionRenderer section={section} />
        </HomepageSectionShell>
      ))}
    </>
  );
}

/** The page's main heading for search engines / screen readers (the hero is visual). */
function HomeHeading() {
  const { settings } = useStoreSettings();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const name = (isAr ? settings?.storeNameAr : settings?.storeNameEn) || settings?.storeNameAr || '';
  const tagline = isAr ? settings?.taglineAr : settings?.taglineEn;
  const fallback = isAr ? 'تسوق البقالة والمنتجات المنزلية أونلاين' : 'Shop groceries online';
  return <h1 className="sr-only">{[name, tagline || fallback].filter(Boolean).join(' — ')}</h1>;
}

export default function HomePage() {
  const loaderData = useLoaderData();
  const { sections, loading } = useHomepageSections(loaderData?.sections);

  if (sections?.length) {
    return (
      <div className="pb-10">
        <HomeHeading />
        <CmsHomeContent sections={sections} />
      </div>
    );
  }

  if (loading) return <HomePageSkeleton />;

  return (
    <>
      <HomeHeading />
      <FallbackHome />
    </>
  );
}
