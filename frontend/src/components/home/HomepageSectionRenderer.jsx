import HeroSlider from './HeroSlider';
import HomeFreeDeliveryBanner from './HomeFreeDeliveryBanner';
import HomeBrowseHub from './HomeBrowseHub';
import ProductSection from './ProductSection';
import BrandRow from './BrandRow';
import HomeDeliveryBar from './HomeDeliveryBar';
import ImageStripSection from './ImageStripSection';
import TrendingSearchesHomeSection from './TrendingSearchesHomeSection';
import CategoriesScroll from './CategoriesScroll';
import HomepageCtaSection from './HomepageCtaSection';
import HomepageLoyaltyPromo from './HomepageLoyaltyPromo';
import HomepageRecurringPromo from './HomepageRecurringPromo';
import HomepageAnnouncementStrip from './HomepageAnnouncementStrip';
import HomepageAppDownload from './HomepageAppDownload';
import HomepagePromoGrid from './HomepagePromoGrid';
import HomepageSplitPromo from './HomepageSplitPromo';
import HomepageSidebarBanners from './HomepageSidebarBanners';
import {
  HomepageTrustBar,
  HomepageStatsBar,
  HomepageFeatureCards,
  HomepageDualCta,
} from './HomepageBlocks';
import HomepageDealSection from './HomepageDealSection';
import {
  productSectionLayout,
} from '../../utils/dealSectionShared';
import { useLanguage } from '../../context/LanguageContext';

function SeoTextSection({ section, centered = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const bodyAr = section.seoContent?.bodyAr;
  const bodyEn = section.seoContent?.bodyEn;
  const body = isAr ? bodyAr : bodyEn;

  if (!body) return null;

  const isCenter = centered || section.layout === 'centered';

  return (
    <section className="container-app py-8">
      <div className={`rounded-2xl border border-border bg-white p-6 shadow-sm ${isCenter ? 'text-center' : ''}`}>
        <h2 className="text-xl font-bold md:text-2xl">{isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr}</h2>
        <p className={`mt-4 whitespace-pre-line text-sm leading-7 text-text-muted ${isCenter ? 'mx-auto max-w-2xl' : ''}`}>{body}</p>
      </div>
    </section>
  );
}

export default function HomepageSectionRenderer({ section }) {
  switch (section.type) {
    case 'hero_slider':
      return (
        <HeroSlider
          slides={section.banners ?? []}
          loading={false}
          autoplaySeconds={section.heroAutoplaySeconds ?? 6}
        />
      );

    case 'browse_hub':
    case 'top_categories':
      return <HomeBrowseHub section={section} />;

    case 'free_delivery_banner':
      return <HomeFreeDeliveryBanner />;

    case 'delivery_area_bar':
      return <HomeDeliveryBar />;

    case 'categories_scroll':
      return <CategoriesScroll section={section} />;

    case 'subcategories_preview':
    case 'all_products_entry':
      return <HomeBrowseHub section={section} />;

    case 'daily_offers':
    case 'flash_sale':
      return (
        <div className="container-app">
          <HomepageDealSection section={section} />
        </div>
      );

    case 'product_carousel':
    case 'product_grid':
    case 'category_spotlight':
    case 'top_rated': {
      const layout = productSectionLayout(section);
      return (
        <div className="container-app">
          <ProductSection
            titleAr={section.titleAr}
            titleEn={section.titleEn}
            subtitleAr={section.subtitleAr}
            subtitleEn={section.subtitleEn}
            icon={section.icon}
            products={section.products || []}
            link={layout.showViewAll ? section.link : null}
            layout={layout.layout}
            columns={layout.columns}
            showViewAll={layout.showViewAll}
            skeletonCount={Number(section.productQuery?.limit) || 8}
          />
        </div>
      );
    }

    case 'trending_searches':
      return <TrendingSearchesHomeSection section={section} />;

    case 'brand_row':
      return (
        <BrandRow
          section={section}
          items={section.items}
        />
      );

    case 'image_strip':
      return <ImageStripSection section={section} banners={section.banners || []} items={section.items || []} />;

    case 'promo_grid':
      if ((section.layout || 'grid') === 'scroll') {
        return <ImageStripSection section={section} banners={section.banners || []} items={section.items || []} />;
      }
      return <HomepagePromoGrid section={section} banners={section.banners || []} />;

    case 'sidebar_banners':
      return <HomepageSidebarBanners section={section} banners={section.banners || []} />;

    case 'announcement_strip':
    case 'flash_strip':
      return <HomepageAnnouncementStrip section={section} />;

    case 'split_promo':
      return <HomepageSplitPromo section={section} />;

    case 'trust_badges':
      return <HomepageTrustBar section={section} />;

    case 'stats_bar':
      return <HomepageStatsBar section={section} />;

    case 'feature_cards':
      return <HomepageFeatureCards section={section} />;

    case 'dual_cta':
      return <HomepageDualCta section={section} />;

    case 'cta_card':
    case 'signup_promo':
    case 'favorites_promo':
    case 'track_order_promo':
    case 'offers_banner':
    case 'faq_teaser':
      return <HomepageCtaSection section={section} />;

    case 'rich_text_block':
      return <SeoTextSection section={section} centered />;

    case 'loyalty_promo':
      return <HomepageLoyaltyPromo section={section} />;

    case 'recurring_promo':
      return <HomepageRecurringPromo section={section} />;

    case 'app_download':
      return <HomepageAppDownload section={section} />;

    case 'seo_text':
      return <SeoTextSection section={section} />;

    default:
      return null;
  }
}
