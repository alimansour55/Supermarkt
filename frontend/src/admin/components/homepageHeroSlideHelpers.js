export const EMPTY_HERO_SLIDE = {
  source: 'manual',
  bannerId: null,
  titleAr: '',
  titleEn: '',
  subtitleAr: '',
  subtitleEn: '',
  image: '',
  desktopImage: '',
  mobileImage: '',
  link: '/products',
  ctaAr: 'تسوق الآن',
  ctaEn: 'Shop Now',
  isActive: true,
};

export function slidePreviewUrl(slide) {
  return slide?.desktopImage || slide?.image || slide?.mobileImage || '';
}

export function slideFromBanner(banner) {
  return {
    source: 'banner',
    bannerId: banner._id,
    titleAr: banner.titleAr || '',
    titleEn: banner.titleEn || '',
    subtitleAr: banner.subtitleAr || '',
    subtitleEn: banner.subtitleEn || '',
    image: banner.image || banner.desktopImage || '',
    desktopImage: banner.desktopImage || banner.image || '',
    mobileImage: banner.mobileImage || '',
    link: banner.link || '/products',
    ctaAr: banner.ctaAr || 'تسوق الآن',
    ctaEn: banner.ctaEn || 'Shop Now',
    isActive: true,
  };
}
