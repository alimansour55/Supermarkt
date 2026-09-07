import { useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  List,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import HomepageSectionRenderer from '../../components/home/HomepageSectionRenderer';
import Button from '../../components/ui/Button';
import {
  getLegacySectionMergeHint,
  getSectionTypeMeta,
  isLegacyMergedSectionType,
} from '../utils/homepageSectionMeta';
import SectionCategoryWarning from './SectionCategoryWarning';
import { sectionUsesCategoryLink } from '../utils/sectionCategoryHealth';

function sortOrderForInsert(sections, afterIndex) {
  if (!sections.length) return 10;
  if (afterIndex < 0) return Math.max(1, (sections[0].sortOrder ?? 10) - 10);
  if (afterIndex >= sections.length - 1) {
    return (sections[sections.length - 1].sortOrder ?? 0) + 10;
  }
  const before = sections[afterIndex].sortOrder ?? 0;
  const after = sections[afterIndex + 1].sortOrder ?? before + 20;
  const mid = Math.floor((before + after) / 2);
  return mid > before ? mid : before + 5;
}

function InsertSlot({ isAr, onInsert, disabled }) {
  return (
    <div className="group relative flex h-10 items-center justify-center">
      <div className="absolute inset-x-6 top-1/2 h-0 border-t border-dashed border-slate-200 transition group-hover:border-primary-300" />
      <button
        type="button"
        disabled={disabled}
        onClick={onInsert}
        className="relative z-10 flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-slate-500 shadow-sm transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 opacity-80 group-hover:opacity-100"
        title={isAr ? 'إضافة قسم هنا' : 'Add section here'}
        aria-label={isAr ? 'إضافة قسم هنا' : 'Add section here'}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden text-[10px] font-bold sm:inline">{isAr ? 'إضافة' : 'Add'}</span>
      </button>
    </div>
  );
}

function SectionPreviewBlock({
  section,
  index,
  total,
  isAr,
  reordering,
  busy,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleMobile,
  onMoveUp,
  onMoveDown,
  mobilePreview,
}) {
  const meta = getSectionTypeMeta(section.type);
  const title = isAr ? section.titleAr || section.titleEn || meta.labelAr : section.titleEn || section.titleAr || meta.labelEn;
  const hiddenOnMobile = section.showOnMobile === false;
  const isHidden = !section.isActive;
  const legacyHint = isLegacyMergedSectionType(section.type)
    ? getLegacySectionMergeHint(section.type, isAr)
    : '';

  const dimForMobile = mobilePreview && hiddenOnMobile;

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl border-2 bg-white shadow-sm transition',
        isHidden ? 'border-slate-300 opacity-75' : 'border-slate-200 hover:border-primary-300',
        dimForMobile ? 'opacity-50' : '',
        busy ? 'ring-2 ring-primary-300' : '',
      ].join(' ')}
    >
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
        <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />

        <span className="text-base" aria-hidden>{section.icon || meta.icon}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-bold text-slate-800">{title}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {isAr ? meta.labelAr : meta.labelEn}
            </span>
            <span className="text-[10px] font-medium text-slate-400">#{section.sortOrder}</span>
          </div>
          {legacyHint && (
            <p className="mt-0.5 truncate text-[10px] font-medium text-amber-700">{legacyHint}</p>
          )}
          {sectionUsesCategoryLink(section) && (
            <div className="mt-1.5">
              <SectionCategoryWarning
                categoryId={section.categoryId || section.category?._id || section.category}
                category={section.category}
                categoryIssue={section.categoryIssue}
                isAr={isAr}
                compact
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {isHidden && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {isAr ? 'مخفي' : 'Hidden'}
            </span>
          )}
          {hiddenOnMobile && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {isAr ? 'سطح المكتب' : 'Desktop'}
            </span>
          )}
          {isLegacyMergedSectionType(section.type) && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              {isAr ? 'قديم' : 'Legacy'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={reordering || busy || index === 0}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            aria-label={isAr ? 'أعلى' : 'Move up'}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={reordering || busy || index === total - 1}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            aria-label={isAr ? 'أسفل' : 'Move down'}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={reordering || busy}
            onClick={(e) => { e.stopPropagation(); onToggleMobile(); }}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            title={hiddenOnMobile ? (isAr ? 'إظهار على الموبايل' : 'Show on mobile') : (isAr ? 'إخفاء على الموبايل' : 'Hide on mobile')}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={reordering || busy}
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            title={isHidden ? (isAr ? 'إظهار' : 'Show') : (isAr ? 'إخفاء' : 'Hide')}
          >
            {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={reordering || busy}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded p-1.5 text-primary-700 hover:bg-primary-50 disabled:opacity-30"
            title={isAr ? 'تعديل' : 'Edit'}
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={reordering || busy}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
            title={isAr ? 'حذف' : 'Delete'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={`relative ${isHidden ? 'pointer-events-none' : 'cursor-pointer'}`}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}
        role="button"
        tabIndex={0}
        aria-label={isAr ? 'تعديل القسم' : 'Edit section'}
      >
        {isHidden && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-slate-900/25 backdrop-grayscale" />
        )}
        <div className="pointer-events-none select-none [&_a]:pointer-events-none">
          <HomepageSectionRenderer section={section} />
        </div>
        {!section.isActive && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-slate-900/10">
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-bold text-white">
              {isAr ? 'غير ظاهر للزوار' : 'Not visible to visitors'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomepageVisualBuilder({
  sections,
  isAr,
  reordering,
  busySectionId = null,
  viewMode,
  onViewModeChange,
  onViewList,
  onInsertAt,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleMobile,
  onReorder,
}) {
  const sorted = useMemo(
    () => [...sections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a._id).localeCompare(String(b._id))),
    [sections],
  );

  const moveBy = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((section, i) => ({ ...section, sortOrder: (i + 1) * 10 })));
  };

  const previewSections = useMemo(() => {
    if (viewMode !== 'mobile') return sorted;
    return sorted.filter((s) => s.showOnMobile !== false);
  }, [sorted, viewMode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-bold text-text">
            {isAr ? 'معاينة الصفحة الرئيسية' : 'Homepage preview'}
          </p>
          <p className="text-xs text-text-muted">
            {isAr
              ? 'كما يراها الزائر — مرّر بين الأقسام، اضغط + للإضافة، أو عدّل من الشريط العلوي لكل قسم.'
              : 'Live visitor view — hover between sections to add (+), or use each section toolbar to edit.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-surface-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('desktop')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'desktop' ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              {isAr ? 'سطح المكتب' : 'Desktop'}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('mobile')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'mobile' ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {isAr ? 'موبايل' : 'Mobile'}
            </button>
          </div>
          {onViewList && (
            <Button type="button" size="sm" variant="secondary" onClick={onViewList}>
              <List className="h-4 w-4" />
              {isAr ? 'عرض القائمة' : 'List view'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className={[
            'w-full overflow-hidden rounded-2xl border border-slate-300 bg-[#f8faf9] shadow-lg transition-all',
            viewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-5xl',
          ].join(' ')}
        >
          <div className="border-b border-slate-200 bg-white px-4 py-2 text-center text-[11px] font-medium text-slate-500">
            {viewMode === 'mobile'
              ? (isAr ? 'معاينة الموبايل — الأقسام المخفية على الموبايل لا تظهر' : 'Mobile preview — sections hidden on mobile are omitted')
              : (isAr ? 'معاينة سطح المكتب — الأقسام المخفية تظهر باهتة' : 'Desktop preview — hidden sections shown dimmed')}
          </div>

          <div className="min-h-[320px] bg-white pb-6 pt-2">
            <InsertSlot
              isAr={isAr}
              disabled={reordering}
              onInsert={() => onInsertAt(-1, sortOrderForInsert(sorted, -1))}
            />

            {(viewMode === 'mobile' ? previewSections : sorted).map((section) => {
              const realIndex = sorted.findIndex((s) => s._id === section._id);
              return (
                <div key={section._id}>
                  <SectionPreviewBlock
                    section={section}
                    index={realIndex}
                    total={sorted.length}
                    isAr={isAr}
                    reordering={reordering}
                    busy={busySectionId === section._id}
                    mobilePreview={viewMode === 'mobile'}
                    onEdit={() => onEdit(section)}
                    onDelete={() => onDelete(section)}
                    onToggleActive={() => onToggleActive(section)}
                    onToggleMobile={() => onToggleMobile(section)}
                    onMoveUp={() => moveBy(realIndex, -1)}
                    onMoveDown={() => moveBy(realIndex, 1)}
                  />
                  <InsertSlot
                    isAr={isAr}
                    disabled={reordering}
                    onInsert={() => onInsertAt(realIndex, sortOrderForInsert(sorted, realIndex))}
                  />
                </div>
              );
            })}

            {sorted.length === 0 && (
              <div className="mx-4 rounded-xl border border-dashed border-slate-300 py-16 text-center">
                <p className="text-sm text-text-muted">
                  {isAr ? 'لا توجد أقسام — اضغط + أعلاه لبدء البناء' : 'No sections — click + above to start building'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
