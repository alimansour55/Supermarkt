import { useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, Edit3, Eye, EyeOff, GripVertical, Smartphone, Trash2,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { getSectionTypeMeta, getSectionCategory, getLegacySectionMergeHint, isLegacyMergedSectionType } from '../utils/homepageSectionMeta';
import {
  announcementStyleMeta,
  formatAnnouncementPhaseLabel,
  getAnnouncementPhase,
} from '../utils/announcementUtils';
import { formatSplitPromoSummary } from '../utils/splitPromoUtils';
import {
  formatBrowseHubSummary,
  formatCategoryNavSummary,
  formatBrandRowSummary,
} from '../utils/browseSectionSummaries';
import SectionCategoryWarning from './SectionCategoryWarning';
import { sectionUsesCategoryLink } from '../utils/sectionCategoryHealth';

function reorderList(list, fromIndex, toIndex) {
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next.map((section, index) => ({
    ...section,
    sortOrder: (index + 1) * 10,
  }));
}

export default function HomepageSectionsList({
  sections,
  isAr,
  reordering = false,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleMobile,
}) {
  const dragIndex = useRef(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const applyReorder = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    onReorder(reorderList(sections, fromIndex, toIndex));
  };

  const moveBy = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    applyReorder(index, target);
  };

  const handleDragStart = (e, index) => {
    if (reordering) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    dragIndex.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (index) => {
    if (dragIndex.current === null) return;
    applyReorder(dragIndex.current, index);
    dragIndex.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {isAr
          ? 'اسحب من ⋮⋮ لإعادة الترتيب — أو استخدم الأسهم. يُحفظ الترتيب تلقائياً.'
          : 'Drag by ⋮⋮ to reorder — or use arrows. Order saves automatically.'}
      </p>

      {sections.map((section, index) => {
        const meta = getSectionTypeMeta(section.type);
        const category = getSectionCategory(section.type);
        const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
        const productCount = section.products?.length || 0;
        const isDragging = draggingIndex === index;
        const isDropTarget = dragOverIndex === index;

        return (
          <div
            key={section._id}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={[
              'flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm transition md:flex-row md:items-center',
              isDropTarget ? 'border-primary-400 ring-2 ring-primary-200' : 'border-border',
              isDragging ? 'opacity-50' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                draggable={!reordering}
                onDragStart={(e) => handleDragStart(e, index)}
                disabled={reordering}
                className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-xl border border-border bg-surface-muted/50 text-slate-400 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 active:cursor-grabbing disabled:cursor-not-allowed"
                aria-label={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </button>

              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={reordering || index === 0}
                  onClick={() => moveBy(index, -1)}
                  className="rounded p-0.5 text-text-muted hover:bg-surface disabled:opacity-30"
                  aria-label={isAr ? 'أعلى' : 'Move up'}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={reordering || index === sections.length - 1}
                  onClick={() => moveBy(index, 1)}
                  className="rounded p-0.5 text-text-muted hover:bg-surface disabled:opacity-30"
                  aria-label={isAr ? 'أسفل' : 'Move down'}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xl">
                {section.icon || meta.icon}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">{title || (isAr ? meta.labelAr : meta.labelEn)}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {isAr ? meta.labelAr : meta.labelEn}
                </span>
                {category && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-800">
                    {isAr ? category.labelAr : category.labelEn}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  #{section.sortOrder}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${section.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                  {section.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مخفي' : 'Hidden')}
                </span>
                {isLegacyMergedSectionType(section.type) && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    {isAr ? 'قديم' : 'Legacy'}
                  </span>
                )}
                {section.showOnMobile === false && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {isAr ? 'سطح المكتب فقط' : 'Desktop only'}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-text-muted">
                {section.category
                  ? `${isAr ? 'قسم:' : 'Category:'} ${isAr ? section.category.nameAr : section.category.nameEn}`
                  : section.categoryId
                    ? `${isAr ? 'قسم محذوف' : 'Missing category'} (${section.categoryId})`
                    : section.link || section.campaignPlacement || (isAr ? meta.descriptionAr : meta.descriptionEn)}
                {productCount > 0 && ` · ${productCount} ${isAr ? 'منتج' : 'products'}`}
              </p>
              {sectionUsesCategoryLink(section) && (
                <SectionCategoryWarning
                  categoryId={section.categoryId || section.category?._id || section.category}
                  category={section.category}
                  categoryIssue={section.categoryIssue}
                  isAr={isAr}
                  compact
                  className="mt-2"
                />
              )}
              {isLegacyMergedSectionType(section.type) && (
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  {getLegacySectionMergeHint(section.type, isAr)}
                </p>
              )}
              {['announcement_strip', 'flash_strip'].includes(section.type) && (() => {
                const config = section.announcementConfig || {};
                const phase = section.announcementPhase || getAnnouncementPhase(config);
                const style = announcementStyleMeta(section.layout || 'accent');
                const isRotate = config.mode === 'rotate';
                const rotateCount = (section.items || []).filter((i) => i.titleAr || i.titleEn).length;
                const hasSingle = !!(section.titleAr || section.titleEn);
                const empty = isRotate ? rotateCount === 0 : !hasSingle;
                const phaseLabel = formatAnnouncementPhaseLabel(phase, isAr);
                const styleLabel = isAr ? style.labelAr : style.labelEn;
                const phaseColor = phase === 'active' && !empty ? 'text-emerald-700' : empty ? 'text-red-700' : 'text-amber-700';
                const extras = [
                  styleLabel,
                  isRotate ? (isAr ? `تناوب · ${rotateCount}` : `rotate · ${rotateCount}`) : (isAr ? 'رسالة واحدة' : 'single'),
                  config.sticky ? (isAr ? 'ثابت' : 'sticky') : null,
                  config.dismissible ? (isAr ? 'قابل للإغلاق' : 'dismissible') : null,
                ].filter(Boolean).join(' · ');
                if (empty) {
                  return (
                    <p className="mt-1 text-xs font-semibold text-red-700">
                      {isAr ? `⚠ ${phaseLabel} — ${isRotate ? 'أضف رسائل للتناوب' : 'أضف نص الإعلان'}` : `⚠ ${phaseLabel} — ${isRotate ? 'add rotation messages' : 'add announcement text'}`}
                    </p>
                  );
                }
                return (
                  <p className={`mt-1 text-xs font-semibold ${phaseColor}`}>
                    {phase === 'active'
                      ? (isAr ? `✓ ${phaseLabel} · ${extras}` : `✓ ${phaseLabel} · ${extras}`)
                      : (isAr ? `⚠ ${phaseLabel} · ${extras}` : `⚠ ${phaseLabel} · ${extras}`)}
                  </p>
                );
              })()}
              {section.type === 'split_promo' && (() => {
                const { count, config, layoutLabel, styleLabel } = formatSplitPromoSummary(section, isAr);
                const empty = count === 0;
                const cols = config.layout === 'balanced' ? config.columns : 2;
                const detail = [
                  `${cols} ${isAr ? 'أعمدة' : 'cols'}`,
                  layoutLabel,
                  styleLabel,
                ].filter(Boolean).join(' · ');
                return (
                  <p className={`mt-1 text-xs font-semibold ${empty ? 'text-red-700' : 'text-emerald-700'}`}>
                    {empty
                      ? (isAr ? '⚠ لا بانرات — أضف بطاقة واحدة على الأقل' : '⚠ No tiles — add at least one banner')
                      : (isAr ? `✓ ${count} بانر · ${detail}` : `✓ ${count} tile(s) · ${detail}`)}
                  </p>
                );
              })()}
              {['browse_hub', 'top_categories', 'subcategories_preview', 'all_products_entry'].includes(section.type) && (() => {
                const { label, subCount } = formatBrowseHubSummary(section, isAr);
                return (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {isAr ? `✓ ${label} · ${subCount} فرعية` : `✓ ${label} · ${subCount} subcategories`}
                  </p>
                );
              })()}
              {section.type === 'categories_scroll' && (() => {
                const { layoutLabel, columns, showTitle } = formatCategoryNavSummary(section, isAr);
                const detail = [
                  layoutLabel,
                  layoutLabel && section.categoryNavConfig?.layout === 'grid' ? `${columns} ${isAr ? 'أعمدة' : 'cols'}` : null,
                  showTitle ? null : (isAr ? 'بدون عنوان' : 'no title'),
                ].filter(Boolean).join(' · ');
                return (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {isAr ? `✓ أقسام المتجر · ${detail}` : `✓ Store categories · ${detail}`}
                  </p>
                );
              })()}
              {section.type === 'brand_row' && (() => {
                const { layoutLabel, count, columns } = formatBrandRowSummary(section, isAr);
                const detail = [
                  layoutLabel,
                  layoutLabel && section.brandRowConfig?.layout === 'grid' ? `${columns} ${isAr ? 'أعمدة' : 'cols'}` : null,
                  count ? `${count} ${isAr ? 'علامة' : 'brand(s)'}` : (isAr ? 'افتراضي' : 'defaults'),
                ].filter(Boolean).join(' · ');
                return (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {isAr ? `✓ صف العلامات · ${detail}` : `✓ Brand row · ${detail}`}
                  </p>
                );
              })()}
              {['hero_slider', 'promo_grid', 'image_strip', 'sidebar_banners'].includes(section.type) && (
                <p className={`mt-1 text-xs font-semibold ${(section.banners?.length || 0) === 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {section.heroMode === 'weekly_rotation'
                    ? (() => {
                        const phase = section.heroSchedulePhase;
                        const phaseAr = phase === 'disabled' ? 'متوقف' : phase === 'before' ? 'قبل البداية' : phase === 'after' ? 'بعد النهاية' : 'نشط';
                        const phaseEn = phase === 'disabled' ? 'paused' : phase === 'before' ? 'before start' : phase === 'after' ? 'after end' : 'active';
                        const isStripType = section.type === 'image_strip' || (section.type === 'promo_grid' && section.layout === 'scroll');
                        const itemAr = isStripType ? 'بلاطة' : section.type === 'promo_grid' ? 'بطاقة' : section.type === 'sidebar_banners' ? 'بانر' : 'بانر';
                        const itemEn = isStripType ? 'tile(s)' : section.type === 'promo_grid' ? 'card(s)' : section.type === 'sidebar_banners' ? 'banner(s)' : 'banner(s)';
                        if ((section.banners?.length || 0) === 0) {
                          return phase === 'active'
                            ? (isAr ? `⚠ جدولة نشطة — لا ${itemAr} للفترة الحالية` : `⚠ Schedule active — no ${itemEn} for current period`)
                            : (isAr ? `⚠ ${phaseAr} — لا محتوى احتياطي` : `⚠ ${phaseEn} — no fallback`);
                        }
                        const extra = section.type === 'promo_grid'
                          ? ` · ${section.gridColumns || 3} ${isAr ? 'أعمدة' : 'cols'}`
                          : section.type === 'image_strip'
                            ? ` · ${section.layout === 'grid' ? `${section.gridColumns || 4} ${isAr ? 'أعمدة' : 'cols'}` : (isAr ? 'تمرير' : 'scroll')}`
                            : '';
                        return isAr
                          ? `✓ ${phaseAr} · ${section.heroRotationUnit || 'week'} ${section.heroRotationPeriodIndex || '?'}/${section.heroRotationCycleLength || '?'} · ${section.banners.length} ${itemAr}${extra}`
                          : `✓ ${phaseEn} · ${section.heroRotationUnit || 'week'} ${section.heroRotationPeriodIndex || '?'}/${section.heroRotationCycleLength || '?'} · ${section.banners.length} ${itemEn}${extra}`;
                      })()
                    : section.heroMode === 'auto'
                      ? ((section.banners?.length || 0) === 0
                        ? (isAr ? '⚠ تلقائي — لا بانرات نشطة للموضع' : '⚠ Auto — no active banners for placement')
                        : (isAr
                          ? `✓ تلقائي · ${section.banners.length} ${section.type === 'image_strip' ? 'بلاطة' : section.type === 'promo_grid' ? 'بطاقة' : 'بانر'}${section.type === 'promo_grid' ? ` · ${section.gridColumns || 3} أعمدة` : section.type === 'image_strip' ? ` · ${section.layout === 'grid' ? `${section.gridColumns || 4} أعمدة` : 'تمرير'}` : ''}`
                          : `✓ Auto · ${section.banners.length} ${section.type === 'image_strip' ? 'tile(s)' : section.type === 'promo_grid' ? 'card(s)' : 'banner(s)'}${section.type === 'promo_grid' ? ` · ${section.gridColumns || 3} cols` : section.type === 'image_strip' ? ` · ${section.layout === 'grid' ? `${section.gridColumns || 4} cols` : 'scroll'}` : ''}`))
                      : ((section.banners?.length || 0) === 0
                        ? (isAr
                          ? (section.type === 'image_strip' ? '⚠ لا بلاطات — أضف صوراً أو استورد حملات' : section.type === 'promo_grid' ? '⚠ لا بطاقات — أضف صوراً أو استورد حملات' : '⚠ لا شرائح — أضف صوراً أو استورد بانرات')
                          : (section.type === 'image_strip' ? '⚠ No tiles — add images or import campaigns' : section.type === 'promo_grid' ? '⚠ No cards — add images or import campaigns' : '⚠ No slides — add images or import banners'))
                        : (isAr
                          ? `✓ ${section.banners.length} ${section.type === 'image_strip' ? 'بلاطة' : section.type === 'promo_grid' ? 'بطاقة' : 'شريحة'}${section.type === 'promo_grid' ? ` · ${section.gridColumns || 3} أعمدة` : section.type === 'image_strip' ? ` · ${section.layout === 'grid' ? `${section.gridColumns || 4} أعمدة` : 'تمرير'}` : ''}`
                          : `✓ ${section.banners.length} ${section.type === 'image_strip' ? 'tile(s)' : section.type === 'promo_grid' ? 'curated card(s)' : 'curated slide(s)'}${section.type === 'promo_grid' ? ` · ${section.gridColumns || 3} cols` : section.type === 'image_strip' ? ` · ${section.layout === 'grid' ? `${section.gridColumns || 4} cols` : 'scroll'}` : ''}`))}
                </p>
              )}
              {['daily_offers', 'flash_sale'].includes(section.type) && (() => {
                const count = section.products?.length || section.linkedPromotion?.productCount || 0;
                const linked = section.linkedPromotion;
                const status = linked?.status;
                const statusAr = status === 'active' ? 'نشط' : status === 'scheduled' ? 'مجدول' : status === 'paused' ? 'متوقف' : status === 'ended' ? 'منتهي' : '';
                const statusEn = status || '';
                const hidden = !section.isActive;
                const warn = hidden || count === 0 || status === 'paused' || status === 'ended';
                return (
                  <p className={`mt-1 text-xs font-semibold ${warn ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {hidden
                      ? (isAr ? '⚠ القسم مخفي — اضغط «إظهار» ليظهر في الموقع' : '⚠ Section hidden — click Show to publish on storefront')
                      : !linked && !section.promotionId
                        ? (isAr ? '⚠ لم تُربط حملة — اختر حملة موجودة أو احفظ يدوياً' : '⚠ No campaign linked — pick a campaign or save manually')
                        : count === 0
                          ? (isAr ? `⚠ حملة مرتبطة${statusAr ? ` (${statusAr})` : ''} — لا منتجات` : `⚠ Linked campaign${statusEn ? ` (${statusEn})` : ''} — no products`)
                          : (isAr
                            ? `✓ ${count} منتج · حملة ${statusAr || 'مرتبطة'}`
                            : `✓ ${count} product(s) · campaign ${statusEn || 'linked'}`)}
                  </p>
                );
              })()}
              {section.type === 'hero_slider' && section.sortOrder > 30 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {isAr ? '↕ اسحب للأعلى — السلايدر يظهر في موضع الترتيب (يُفضّل أعلى الصفحة)' : '↕ Drag up — slider appears at this sort position (prefer top)'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onToggleMobile(section)}
                title={isAr ? 'إظهار/إخفاء على الموبايل' : 'Toggle mobile visibility'}
              >
                <Smartphone className="h-4 w-4" />
                {section.showOnMobile === false ? (isAr ? 'موبايل: مخفي' : 'Mobile: off') : (isAr ? 'موبايل: ظاهر' : 'Mobile: on')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => onToggleActive(section)}>
                {section.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {section.isActive ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(section)} disabled={reordering}>
                <Edit3 className="h-4 w-4" />
                {isAr ? 'تعديل' : 'Edit'}
              </Button>
              <Button type="button" size="sm" variant="danger" onClick={() => onDelete(section)}>
                <Trash2 className="h-4 w-4" />
                {isAr ? 'حذف' : 'Delete'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
