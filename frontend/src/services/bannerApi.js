/**
 * Banner fetching. Demo banners from mockData are only used when the app runs
 * without an API (VITE_USE_API=false) — never as a stand-in for real banners,
 * so customers can't be shown campaigns the store never created.
 */
import { bannerService } from './apiServices';
import { HERO_SLIDES, PROMO_BANNERS } from '../data/mockData';

const useApi = import.meta.env.VITE_USE_API !== 'false';

const HERO_GRADIENTS = [
  'from-emerald-600 via-green-600 to-teal-700',
  'from-lime-600 via-green-600 to-emerald-700',
  'from-amber-500 via-orange-500 to-red-500',
];

const PROMO_STYLES = [
  { bg: 'bg-gradient-to-l from-blue-500 to-blue-600', emoji: '🥛' },
  { bg: 'bg-gradient-to-l from-cyan-500 to-teal-600', emoji: '🥤' },
  { bg: 'bg-gradient-to-l from-amber-500 to-orange-600', emoji: '🍞' },
];

async function tryApi(fn, demo) {
  if (!useApi) return demo();
  try {
    return await fn();
  } catch {
    return [];
  }
}

/** Map MongoDB/seed banner document to hero slide shape */
export function mapHeroBanner(banner, index = 0) {
  return {
    id: banner._id || banner.id || index,
    titleAr: banner.titleAr,
    titleEn: banner.titleEn,
    subtitleAr: banner.subtitleAr || '',
    subtitleEn: banner.subtitleEn || '',
    ctaAr: banner.ctaAr || 'تسوق الآن',
    ctaEn: banner.ctaEn || 'Shop Now',
    link: banner.link || '/offers',
    showText: banner.showText !== false,
    targetAudience: banner.targetAudience || 'all',
    image: banner.desktopImage || banner.image,
    desktopImage: banner.desktopImage || banner.image,
    mobileImage: banner.mobileImage || banner.desktopImage || banner.image,
    gradient: HERO_GRADIENTS[index % HERO_GRADIENTS.length],
    emoji: '🛒',
  };
}

/** Map promo banner from API or use gradient cards */
export function mapPromoBanner(banner, index = 0) {
  const style = PROMO_STYLES[index % PROMO_STYLES.length];
  return {
    id: banner._id || banner.id || index,
    titleAr: banner.titleAr,
    titleEn: banner.titleEn,
    link: banner.link || '/offers',
    showText: banner.showText !== false,
    targetAudience: banner.targetAudience || 'all',
    image: banner.desktopImage || banner.image,
    desktopImage: banner.desktopImage || banner.image,
    mobileImage: banner.mobileImage || banner.desktopImage || banner.image,
    ctaAr: banner.ctaAr || 'تسوق الآن',
    ctaEn: banner.ctaEn || 'Shop Now',
    bg: style.bg,
    emoji: style.emoji,
  };
}

export async function fetchHeroBanners() {
  return tryApi(
    async () => {
      const { data } = await bannerService.getPublic('hero');
      const banners = data.data || [];
      return banners.map(mapHeroBanner);
    },
    () => HERO_SLIDES,
  );
}

export async function fetchPromoBanners() {
  return tryApi(
    async () => {
      const { data } = await bannerService.getPublic('promo');
      const banners = data.data || [];
      return banners.map(mapPromoBanner);
    },
    () => PROMO_BANNERS,
  );
}
