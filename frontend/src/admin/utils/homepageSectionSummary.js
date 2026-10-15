/**
 * One plain-language line per homepage section saying what it shows and whether
 * something is missing — used by the builder outline and the page health bar.
 */
import {
  getLegacySectionMergeHint,
  getSectionTypeMeta,
  isLegacyMergedSectionType,
} from './homepageSectionMeta';
import { formatAnnouncementPhaseLabel, getAnnouncementPhase } from './announcementUtils';
import { formatSplitPromoSummary } from './splitPromoUtils';
import { formatBrandRowSummary, formatBrowseHubSummary, formatCategoryNavSummary } from './browseSectionSummaries';
import { resolveSectionCategoryHealth, sectionCategoryWarningCopy } from './sectionCategoryHealth';

const BANNER_TYPES = ['hero_slider', 'promo_grid', 'image_strip', 'sidebar_banners'];

function bannerNoun(section, count, isAr) {
  const strip = section.type === 'image_strip' || (section.type === 'promo_grid' && section.layout === 'scroll');
  if (isAr) return strip ? 'بلاطة' : section.type === 'promo_grid' ? 'بطاقة' : section.type === 'hero_slider' ? 'شريحة' : 'بانر';
  const word = strip ? 'tile' : section.type === 'promo_grid' ? 'card' : section.type === 'hero_slider' ? 'slide' : 'banner';
  return count === 1 ? word : `${word}s`;
}

function bannerSummary(section, isAr) {
  const count = section.banners?.length || 0;
  const noun = bannerNoun(section, count, isAr);
  if (section.heroMode === 'weekly_rotation') {
    const phase = section.heroSchedulePhase;
    if (!count) {
      return {
        tone: 'error',
        text: isAr ? `جدولة بدون ${noun} للفترة الحالية` : `Rotation has no ${bannerNoun(section, 2, false)} for this period`,
      };
    }
    const unit = section.heroRotationUnit || 'week';
    const period = `${section.heroRotationPeriodIndex || '?'}/${section.heroRotationCycleLength || '?'}`;
    if (phase && phase !== 'active') {
      return { tone: 'ok', text: isAr ? `${count} ${noun} · الجدولة متوقفة حالياً` : `${count} ${noun} · rotation not running now` };
    }
    return { tone: 'ok', text: isAr ? `${count} ${noun} · دورة ${period}` : `${count} ${noun} · ${unit} ${period}` };
  }
  if (section.heroMode === 'auto') {
    return count
      ? { tone: 'ok', text: isAr ? `${count} ${noun} من مكتبة البانرات` : `${count} ${noun} from the banner library` }
      : { tone: 'error', text: isAr ? 'لا توجد بانرات نشطة لهذا المكان' : 'No live banners for this placement' };
  }
  return count
    ? { tone: 'ok', text: `${count} ${noun}` }
    : { tone: 'error', text: isAr ? 'فارغ — أضف صوراً' : 'Empty — add images' };
}

/** { tone: 'ok' | 'warn' | 'error' | 'muted', text } */
export function sectionContentSummary(section, isAr) {
  const meta = getSectionTypeMeta(section.type);

  if (['announcement_strip', 'flash_strip'].includes(section.type)) {
    const config = section.announcementConfig || {};
    const phase = section.announcementPhase || getAnnouncementPhase(config);
    const rotate = config.mode === 'rotate';
    const count = (section.items || []).filter((i) => i.titleAr || i.titleEn).length;
    const empty = rotate ? count === 0 : !(section.titleAr || section.titleEn);
    if (empty) return { tone: 'error', text: isAr ? 'لا يوجد نص للإعلان' : 'No announcement text yet' };
    const phaseLabel = formatAnnouncementPhaseLabel(phase, isAr);
    const text = rotate ? (isAr ? `${count} رسائل متناوبة` : `${count} rotating messages`) : (isAr ? 'رسالة واحدة' : 'One message');
    return phase === 'active' ? { tone: 'ok', text } : { tone: 'warn', text: `${phaseLabel} · ${text}` };
  }

  if (section.type === 'split_promo') {
    const { count } = formatSplitPromoSummary(section, isAr);
    return count
      ? { tone: 'ok', text: isAr ? `${count} بطاقات` : `${count} cards` }
      : { tone: 'error', text: isAr ? 'لا توجد بطاقات — أضف بطاقة واحدة على الأقل' : 'No cards — add at least one' };
  }

  if (['browse_hub', 'top_categories', 'subcategories_preview', 'all_products_entry'].includes(section.type)) {
    const { label } = formatBrowseHubSummary(section, isAr);
    return { tone: 'ok', text: label };
  }
  if (section.type === 'categories_scroll') {
    const { layoutLabel } = formatCategoryNavSummary(section, isAr);
    return { tone: 'ok', text: [isAr ? 'أقسام المتجر' : 'Store categories', layoutLabel].filter(Boolean).join(' · ') };
  }
  if (section.type === 'brand_row') {
    const { layoutLabel, count } = formatBrandRowSummary(section, isAr);
    return {
      tone: 'ok',
      text: [layoutLabel, count ? `${count} ${isAr ? 'علامة' : 'brands'}` : (isAr ? 'العلامات الافتراضية' : 'Default brands')].filter(Boolean).join(' · '),
    };
  }

  if (BANNER_TYPES.includes(section.type)) return bannerSummary(section, isAr);

  if (['daily_offers', 'flash_sale'].includes(section.type)) {
    const count = section.products?.length || section.linkedPromotion?.productCount || 0;
    const linked = section.linkedPromotion;
    const status = linked?.status;
    if (!linked && !section.promotionId) {
      return { tone: 'warn', text: isAr ? 'لم تُربط حملة خصم' : 'No discount campaign linked' };
    }
    if (status === 'paused' || status === 'ended') {
      return { tone: 'warn', text: isAr ? 'الحملة المرتبطة متوقفة أو منتهية' : 'The linked campaign is paused or has ended' };
    }
    if (!count) return { tone: 'error', text: isAr ? 'الحملة بدون منتجات' : 'The campaign has no products' };
    return { tone: 'ok', text: isAr ? `${count} منتج في العرض` : `${count} products on offer` };
  }

  if (['product_carousel', 'product_grid', 'top_rated', 'category_spotlight', 'trending_searches'].includes(section.type)) {
    const count = section.products?.length || 0;
    if (section.type === 'category_spotlight' && !section.category && !section.categoryId) {
      return { tone: 'error', text: isAr ? 'اختر قسماً لعرض منتجاته' : 'Pick a category to show its products' };
    }
    if (section.type !== 'trending_searches' && !count) {
      return { tone: 'warn', text: isAr ? 'لا توجد منتجات تطابق الاختيار' : 'No products match this selection' };
    }
    return { tone: 'ok', text: count ? `${count} ${isAr ? 'منتج' : 'products'}` : (isAr ? meta.descriptionAr : meta.descriptionEn) };
  }

  if (['seo_text', 'rich_text_block'].includes(section.type)) {
    const body = section.seoContent?.bodyAr || section.seoContent?.bodyEn;
    return body ? { tone: 'ok', text: isAr ? 'نص' : 'Text block' } : { tone: 'error', text: isAr ? 'النص فارغ' : 'The text is empty' };
  }

  return { tone: 'muted', text: isAr ? meta.descriptionAr : meta.descriptionEn };
}

/** The most important content problem of a section, for the page health bar. */
export function sectionContentIssue(section, isAr) {
  const health = resolveSectionCategoryHealth({
    categoryId: section.categoryId,
    category: section.category,
    categoryIssue: section.categoryIssue,
  });
  const copy = sectionCategoryWarningCopy(health, isAr);
  if (copy) return { level: copy.tone === 'danger' ? 'error' : 'warn', text: isAr ? copy.titleAr : copy.titleEn };

  const summary = sectionContentSummary(section, isAr);
  if (summary.tone === 'error') return { level: 'error', text: summary.text };
  if (summary.tone === 'warn') return { level: 'warn', text: summary.text };

  if (isLegacyMergedSectionType(section.type)) {
    return { level: 'info', text: getLegacySectionMergeHint(section.type, isAr) };
  }
  return null;
}

export function sectionTypeLabel(section, isAr) {
  const meta = getSectionTypeMeta(section.type);
  return isAr ? meta.labelAr : meta.labelEn;
}

/** What the admin calls the section: their own label, else the title, else the type. */
export function sectionDisplayName(section, isAr) {
  if (section.adminLabel) return section.adminLabel;
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  return title || sectionTypeLabel(section, isAr);
}

export function sectionIcon(section) {
  return section.icon || getSectionTypeMeta(section.type).icon;
}
