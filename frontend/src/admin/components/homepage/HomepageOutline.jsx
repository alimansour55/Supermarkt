import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Crosshair, Edit3, Eye, EyeOff,
  GripVertical, MoreHorizontal, Plus, Search, Trash2,
} from 'lucide-react';
import { RuleChip } from './HomepageRuleChip';
import { ruleChips, sectionStatus } from '../../utils/homepageBuilderRules';
import {
  sectionContentIssue,
  sectionContentSummary,
  sectionDisplayName,
  sectionIcon,
  sectionTypeLabel,
} from '../../utils/homepageSectionSummary';

const FILTERS = [
  { value: 'all', labelAr: 'الكل', labelEn: 'All' },
  { value: 'live', labelAr: 'ظاهر', labelEn: 'Live' },
  { value: 'later', labelAr: 'مجدول', labelEn: 'Scheduled' },
  { value: 'hidden', labelAr: 'مخفي', labelEn: 'Hidden' },
  { value: 'issues', labelAr: 'يحتاج انتباه', labelEn: 'Needs attention' },
];

const SUMMARY_TONE = {
  ok: 'text-emerald-700',
  warn: 'text-amber-700',
  error: 'text-red-700',
  muted: 'text-text-muted',
};

const MENU_WIDTH = 224;
const MENU_HEIGHT = 330;

function RowMenu({
  isAr, section, canDuplicate, canMove, onEdit, onDuplicate, onToggle, onTop, onBottom, onAddBelow, onDelete, disabled,
}) {
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const open = Boolean(position);
  const setOpen = (next) => {
    if (!next) { setPosition(null); return; }
    // Fixed to the window so the scrolling list can't clip it; flips up near the bottom.
    const rect = buttonRef.current.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    const left = rtl ? Math.max(8, rect.left) : Math.max(8, rect.right - MENU_WIDTH);
    const below = rect.bottom + 4 + MENU_HEIGHT < window.innerHeight;
    setPosition({ left, top: below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - MENU_HEIGHT) });
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setPosition(null); };
    const esc = (e) => { if (e.key === 'Escape') setPosition(null); };
    const dismiss = () => setPosition(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  const item = (Icon, label, action, { danger = false, off = false, title } = {}) => (
    <button
      type="button"
      role="menuitem"
      disabled={off}
      title={title}
      onClick={() => { setOpen(false); action(); }}
      className={[
        'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-red-700 hover:bg-red-50' : 'text-text hover:bg-surface-muted',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-40"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isAr ? 'المزيد' : 'More actions'}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="fixed z-50 w-56 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-xl" style={position}>
          {item(Edit3, isAr ? 'تعديل' : 'Edit', onEdit)}
          {item(Copy, isAr ? 'نسخ القسم' : 'Duplicate', onDuplicate, {
            off: !canDuplicate,
            title: canDuplicate ? undefined : (isAr ? 'أقسام العروض مرتبطة بحملة خصم ولا تُنسخ' : 'Deal sections run their own discount campaign and can’t be copied'),
          })}
          {item(Plus, isAr ? 'إضافة قسم أسفله' : 'Add a section below', onAddBelow)}
          {item(section.isActive ? EyeOff : Eye, section.isActive ? (isAr ? 'إخفاء من المتجر' : 'Hide from store') : (isAr ? 'إظهار في المتجر' : 'Show on store'), onToggle)}
          {item(ArrowUpToLine, isAr ? 'نقل لأعلى الصفحة' : 'Move to top', onTop, { off: !canMove })}
          {item(ArrowDownToLine, isAr ? 'نقل لأسفل الصفحة' : 'Move to bottom', onBottom, { off: !canMove })}
          <div className="my-1 border-t border-border" />
          {item(Trash2, isAr ? 'حذف' : 'Delete', onDelete, { danger: true })}
        </div>
      )}
    </div>
  );
}

/**
 * The builder's section list: order, status, rules and quick actions.
 * Drag (or the arrows) to reorder — only while no filter/search is applied.
 */
export default function HomepageOutline({
  sections,
  isAr,
  zones = [],
  selectedId = null,
  busyId = null,
  reordering = false,
  now,
  onReorder,
  onEdit,
  onLocate,
  onToggleActive,
  onDuplicate,
  onDelete,
  onAddAt,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const rowRefs = useRef(new Map());

  const rows = useMemo(() => sections.map((section, index) => ({
    section,
    index,
    status: sectionStatus(section, now),
    summary: sectionContentSummary(section, isAr),
    issue: sectionContentIssue(section, isAr),
    chips: ruleChips(section, isAr, { now, zones }).filter((chip) => chip.key !== 'status' || chip.label),
    name: sectionDisplayName(section, isAr),
    typeLabel: sectionTypeLabel(section, isAr),
  })), [sections, isAr, now, zones]);

  const counts = useMemo(() => ({
    all: rows.length,
    live: rows.filter((r) => r.status === 'live').length,
    later: rows.filter((r) => ['scheduled', 'off_hours'].includes(r.status)).length,
    hidden: rows.filter((r) => r.status === 'hidden' || r.status === 'ended').length,
    issues: rows.filter((r) => r.issue && r.issue.level !== 'info').length,
  }), [rows]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (filter === 'live' && row.status !== 'live') return false;
    if (filter === 'later' && !['scheduled', 'off_hours'].includes(row.status)) return false;
    if (filter === 'hidden' && !['hidden', 'ended'].includes(row.status)) return false;
    if (filter === 'issues' && !(row.issue && row.issue.level !== 'info')) return false;
    if (q) {
      const hay = [row.name, row.typeLabel, row.section.titleAr, row.section.titleEn, row.section.adminNotes].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const canReorder = filter === 'all' && !q && !reordering;

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const move = (from, to) => {
    if (!canReorder || to < 0 || to >= sections.length || from === to) return;
    onReorder(from, to);
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-white shadow-sm">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? 'ابحث في الأقسام' : 'Search sections'}
            className="w-full rounded-xl border border-border bg-white py-2 pe-3 ps-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={[
                'rounded-full px-2.5 py-1 text-xs font-semibold transition',
                filter === f.value ? 'bg-primary-600 text-white' : 'bg-surface-muted text-text-muted hover:text-text',
                f.value === 'issues' && counts.issues && filter !== f.value ? 'text-red-700' : '',
              ].join(' ')}
            >
              {isAr ? f.labelAr : f.labelEn} <span className="opacity-70">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        {!canReorder && !reordering && (
          <p className="text-[11px] text-text-muted">
            {isAr ? 'امسح البحث والفلتر لإعادة الترتيب.' : 'Clear the search and filter to reorder.'}
          </p>
        )}
      </div>

      <ol className="min-h-0 flex-1 divide-y divide-border overflow-y-auto" aria-label={isAr ? 'أقسام الصفحة الرئيسية' : 'Homepage sections'}>
        {visible.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-text-muted">
            {rows.length === 0
              ? (isAr ? 'لا توجد أقسام بعد' : 'No sections yet')
              : (isAr ? 'لا شيء يطابق البحث' : 'Nothing matches')}
          </li>
        )}
        {visible.map((row) => {
          const { section, index } = row;
          const selected = selectedId === section._id;
          const busy = busyId === section._id;
          const dim = row.status !== 'live';
          return (
            <li
              key={section._id}
              ref={(node) => { if (node) rowRefs.current.set(section._id, node); else rowRefs.current.delete(section._id); }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                endDrag();
              }}
              className={[
                'group relative flex gap-2 px-2 py-2.5 transition',
                selected ? 'bg-primary-50/70' : 'hover:bg-surface-muted/50',
                dragIndex === index ? 'opacity-40' : '',
                overIndex === index && dragIndex !== null && dragIndex !== index
                  ? (dragIndex < index ? 'shadow-[inset_0_-3px_0_0_var(--color-primary-500)]' : 'shadow-[inset_0_3px_0_0_var(--color-primary-500)]')
                  : '',
                busy ? 'pointer-events-none opacity-60' : '',
              ].join(' ')}
            >
              <div className="flex shrink-0 flex-col items-center">
                <button
                  type="button"
                  draggable={canReorder}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', section._id);
                    setDragIndex(index);
                  }}
                  onDragEnd={endDrag}
                  disabled={!canReorder}
                  className="cursor-grab rounded p-0.5 text-slate-400 hover:text-primary-600 active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
                  aria-label={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button type="button" disabled={!canReorder || index === 0} onClick={() => move(index, index - 1)} className="rounded p-0.5 text-slate-400 hover:text-text disabled:opacity-20" aria-label={isAr ? 'أعلى' : 'Move up'}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={!canReorder || index === sections.length - 1} onClick={() => move(index, index + 1)} className="rounded p-0.5 text-slate-400 hover:text-text disabled:opacity-20" aria-label={isAr ? 'أسفل' : 'Move down'}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onEdit(section)}
                className="flex min-w-0 flex-1 gap-2.5 text-start"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-lg ${dim ? 'grayscale' : ''}`} aria-hidden>
                  {sectionIcon(section)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-bold tabular-nums text-text-muted">{index + 1}</span>
                    <span className={`truncate text-sm font-bold ${dim ? 'text-text-muted' : 'text-text'}`}>{row.name}</span>
                  </span>
                  <span className="block truncate text-[11px] text-text-muted">
                    {row.typeLabel}
                    {' · '}
                    <span className={SUMMARY_TONE[row.summary.tone] || SUMMARY_TONE.muted}>{row.summary.text}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {row.chips.map((chip) => <RuleChip key={chip.key} chip={chip} />)}
                  </span>
                  {row.issue && row.issue.level !== 'info' && row.summary.tone === 'ok' && (
                    <span className="mt-1 block truncate text-[11px] font-semibold text-red-700">⚠ {row.issue.text}</span>
                  )}
                </span>
              </button>

              <div className="flex shrink-0 items-start gap-0.5">
                <button
                  type="button"
                  onClick={() => onLocate(section)}
                  className="rounded-lg p-1.5 text-text-muted opacity-0 transition hover:bg-surface-muted hover:text-text focus:opacity-100 group-hover:opacity-100"
                  title={isAr ? 'أظهره في المعاينة' : 'Show in preview'}
                  aria-label={isAr ? 'أظهره في المعاينة' : 'Show in preview'}
                >
                  <Crosshair className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(section)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
                  title={section.isActive ? (isAr ? 'إخفاء من المتجر' : 'Hide from store') : (isAr ? 'إظهار في المتجر' : 'Show on store')}
                  aria-label={section.isActive ? (isAr ? 'إخفاء من المتجر' : 'Hide from store') : (isAr ? 'إظهار في المتجر' : 'Show on store')}
                >
                  {section.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
                </button>
                <RowMenu
                  isAr={isAr}
                  section={section}
                  disabled={busy}
                  canDuplicate={!['daily_offers', 'flash_sale'].includes(section.type)}
                  canMove={canReorder}
                  onEdit={() => onEdit(section)}
                  onDuplicate={() => onDuplicate(section)}
                  onToggle={() => onToggleActive(section)}
                  onTop={() => move(index, 0)}
                  onBottom={() => move(index, sections.length - 1)}
                  onAddBelow={() => onAddAt(index)}
                  onDelete={() => onDelete(section)}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
