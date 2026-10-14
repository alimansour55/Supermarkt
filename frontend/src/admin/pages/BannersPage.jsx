import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Copy, GripVertical, Image, LayoutGrid, Link2, List, Pause, Pencil, Play,
  Search, Trash2, Users, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { bannerAdminApi } from '../bannerAdminApi';
import Button from '../../components/ui/Button';
import { CardSkeleton } from '../components/Skeleton';
import BannerEditorModal from '../components/BannerEditorModal';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';
import { buildHomepageLinkGroups, findLinkPresetInGroups } from '../utils/homepageLinkPresets';
import {
  BANNER_PLACEMENTS,
  STATUS_META,
  WARNING_TEXT,
  audienceMeta,
  bannerId,
  bannerStatus,
  bannerWarnings,
  countByStatus,
  groupByPlacement,
  sectionName,
  statusDetail,
} from '../utils/bannerAdmin';

const VIEW_KEY = 'admin.banners.view';

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function StatusChip({ banner, isAr, now }) {
  const meta = STATUS_META[bannerStatus(banner, now).key];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {isAr ? meta.labelAr : meta.labelEn}
    </span>
  );
}

function BannerThumb({ banner, broken, onBroken, className }) {
  const src = banner.desktopImage || banner.image || banner.mobileImage;
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-text-muted ${className}`}>
        <Image className="h-8 w-8" />
      </div>
    );
  }
  return <img src={src} alt="" loading="lazy" className={`object-cover ${className}`} onError={onBroken} />;
}

export default function BannersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [banners, setBanners] = useState([]);
  const [placementSections, setPlacementSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [editor, setEditor] = useState({ open: false, banner: null });
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState({});
  const [search, setSearch] = useState('');
  const [placementFilter, setPlacementFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [brokenImages, setBrokenImages] = useState({});
  const [view, setView] = useState(readView);
  const [dragging, setDragging] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await bannerAdminApi.list();
      setBanners(data.data ?? []);
      setPlacementSections(data.meta?.placementSections ?? null);
      setNow(Date.now());
    } catch {
      if (!quiet) setBanners([]);
      toast.error(isAr ? 'تعذر تحميل البانرات' : 'Could not load banners');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminApi.getCategories()
      .then(({ data }) => setCategories(data.data ?? data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const linkGroups = useMemo(() => buildHomepageLinkGroups(categories), [categories]);
  const linkLabel = useCallback((link) => {
    const match = findLinkPresetInGroups(link, linkGroups);
    if (match) return (isAr ? match.labelAr : match.labelEn) || link;
    // Sub-categories aren't presets — name them from the category list instead.
    const slug = /^\/category\/(.+)$/.exec(String(link || '').replace(/\/+$/, ''))?.[1]?.split('/').pop();
    const category = slug && categories.find((c) => c.slug === slug);
    if (category) return (isAr ? category.nameAr || category.nameEn : category.nameEn || category.nameAr) || link;
    return link;
  }, [categories, isAr, linkGroups]);

  const warningsById = useMemo(() => Object.fromEntries(banners.map((b) => [
    bannerId(b),
    bannerWarnings(b, { placementSections, brokenImage: brokenImages[bannerId(b)], now }),
  ])), [banners, brokenImages, now, placementSections]);

  const counts = useMemo(() => countByStatus(banners, now), [banners, now]);
  const attentionCount = useMemo(
    () => banners.filter((b) => bannerStatus(b, now).key !== 'ended' && warningsById[bannerId(b)]?.length).length,
    [banners, now, warningsById],
  );

  const filtersActive = Boolean(search.trim()) || placementFilter !== 'all' || statusFilter !== 'all';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter((b) => {
      if (placementFilter !== 'all' && b.placement !== placementFilter) return false;
      const status = bannerStatus(b, now).key;
      if (statusFilter === 'attention') {
        if (status === 'ended' || !warningsById[bannerId(b)]?.length) return false;
      } else if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      return `${b.titleAr || ''} ${b.titleEn || ''} ${b.link || ''} ${linkLabel(b.link)}`.toLowerCase().includes(q);
    });
  }, [banners, linkLabel, now, placementFilter, search, statusFilter, warningsById]);

  const groups = useMemo(() => groupByPlacement(visible), [visible]);

  const markBusy = (id, on) => setBusyIds((prev) => {
    const next = { ...prev };
    if (on) next[id] = true;
    else delete next[id];
    return next;
  });

  const errorMessage = (error, fallbackAr, fallbackEn) => error?.response?.data?.message || (isAr ? fallbackAr : fallbackEn);

  // ---- editor -----------------------------------------------------------
  const openCreate = () => setEditor({ open: true, banner: placementFilter !== 'all' ? { placement: placementFilter } : null });
  const openEdit = (banner) => setEditor({ open: true, banner });
  const closeEditor = () => setEditor({ open: false, banner: null });

  const saveBanner = async ({ form, files }) => {
    const fd = new FormData();
    // Send every field — an empty value means "clear it".
    Object.entries(form).forEach(([key, value]) => fd.append(key, value == null ? '' : String(value)));
    if (files.desktopImage) fd.append('desktopImage', files.desktopImage);
    if (files.mobileImage) fd.append('mobileImage', files.mobileImage);

    const id = bannerId(editor.banner);
    setSaving(true);
    try {
      if (id) await bannerAdminApi.update(id, fd);
      else await bannerAdminApi.create(fd);
      toast.success(isAr ? 'تم حفظ البانر' : 'Banner saved');
      closeEditor();
      await load({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error, 'تعذر الحفظ', 'Could not save banner'));
    } finally {
      setSaving(false);
    }
  };

  // ---- single actions ---------------------------------------------------
  const setActive = async (banner, isActive) => {
    const id = bannerId(banner);
    markBusy(id, true);
    setBanners((prev) => prev.map((b) => (bannerId(b) === id ? { ...b, isActive } : b)));
    try {
      await bannerAdminApi.setStatus(id, isActive);
      return true;
    } catch (error) {
      setBanners((prev) => prev.map((b) => (bannerId(b) === id ? { ...b, isActive: !isActive } : b)));
      toast.error(errorMessage(error, 'تعذر التحديث', 'Could not update'));
      return false;
    } finally {
      markBusy(id, false);
    }
  };

  const toggleActive = async (banner) => {
    const ok = await setActive(banner, !banner.isActive);
    if (ok) {
      toast.success(banner.isActive
        ? (isAr ? 'تم إيقاف البانر' : 'Banner paused')
        : (isAr ? 'تم تشغيل البانر' : 'Banner turned on'));
    }
  };

  const duplicate = async (banner) => {
    const id = bannerId(banner);
    markBusy(id, true);
    try {
      const { data } = await bannerAdminApi.duplicate(id);
      toast.success(isAr ? 'تم إنشاء نسخة متوقفة — عدّلها ثم شغّلها' : 'Paused copy created — edit it, then turn it on');
      await load({ quiet: true });
      if (data?.data) openEdit({ ...data.data, usedIn: [] });
    } catch (error) {
      toast.error(errorMessage(error, 'تعذر النسخ', 'Could not duplicate'));
    } finally {
      markBusy(id, false);
    }
  };

  const deleteMessage = (list) => {
    const used = list.filter((b) => b.usedIn?.length);
    const base = list.length === 1
      ? (isAr ? 'سيُحذف هذا البانر نهائياً.' : 'This banner will be deleted permanently.')
      : (isAr ? `سيُحذف ${list.length} بانر نهائياً.` : `${list.length} banners will be deleted permanently.`);
    if (!used.length) return `${base} ${isAr ? 'لإخفائه مؤقتاً استخدم «إيقاف» بدلاً من ذلك.' : 'To hide it for now, use Pause instead.'}`;
    const names = [...new Set(used.flatMap((b) => b.usedIn.map((s) => sectionName(s, isAr))))].join(isAr ? '، ' : ', ');
    return `${base} ${isAr ? `مختار يدوياً في: ${names} — سيختفي من هناك.` : `It is hand-picked in: ${names} — it will disappear there.`}`;
  };

  const remove = async (banner) => {
    const ok = await confirm({
      title: isAr ? 'حذف البانر' : 'Delete banner',
      message: deleteMessage([banner]),
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    const id = bannerId(banner);
    markBusy(id, true);
    try {
      await bannerAdminApi.remove(id);
      setBanners((prev) => prev.filter((b) => bannerId(b) !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch (error) {
      toast.error(errorMessage(error, 'تعذر الحذف', 'Could not delete'));
    } finally {
      markBusy(id, false);
    }
  };

  // ---- bulk actions -----------------------------------------------------
  const selectedBanners = banners.filter((b) => selected.has(bannerId(b)));
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const bulkSetActive = async (isActive) => {
    const targets = selectedBanners.filter((b) => b.isActive !== isActive);
    const results = await Promise.all(targets.map((b) => setActive(b, isActive)));
    const done = results.filter(Boolean).length;
    if (done) {
      toast.success(isActive
        ? (isAr ? `تم تشغيل ${done}` : `${done} turned on`)
        : (isAr ? `تم إيقاف ${done}` : `${done} paused`));
    }
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const list = selectedBanners;
    const ok = await confirm({
      title: isAr ? 'حذف البانرات المحددة' : 'Delete selected banners',
      message: deleteMessage(list),
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    const results = await Promise.allSettled(list.map((b) => bannerAdminApi.remove(bannerId(b))));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(isAr ? `تعذر حذف ${failed}` : `${failed} could not be deleted`);
    else toast.success(isAr ? 'تم الحذف' : 'Deleted');
    setSelected(new Set());
    await load({ quiet: true });
  };

  // ---- ordering ---------------------------------------------------------
  const saveOrder = async (placement, orderedIds) => {
    const placementAll = groupByPlacement(banners)[placement];
    const rest = placementAll.map(bannerId).filter((id) => !orderedIds.includes(id));
    const ids = [...orderedIds, ...rest];
    const rank = new Map(ids.map((id, index) => [id, index]));
    const previous = banners;
    setBanners((prev) => prev.map((b) => (rank.has(bannerId(b)) ? { ...b, sortOrder: rank.get(bannerId(b)), priority: 0 } : b)));
    try {
      await bannerAdminApi.reorder(placement, ids);
    } catch (error) {
      setBanners(previous);
      toast.error(errorMessage(error, 'تعذر حفظ الترتيب', 'Could not save the order'));
    }
  };

  const move = (placement, list, index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ids = list.map(bannerId);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    saveOrder(placement, ids);
  };

  const dropOn = (placement, list, targetId) => {
    if (!dragging || dragging.placement !== placement || dragging.id === targetId) return;
    const ids = list.map(bannerId).filter((id) => id !== dragging.id);
    ids.splice(ids.indexOf(targetId), 0, dragging.id);
    setDragging(null);
    saveOrder(placement, ids);
  };

  const changeView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* per-viewer convenience only */ }
  };

  // ---- render helpers ---------------------------------------------------
  const canReorder = !filtersActive;

  const renderActions = (banner, { list, index, placement, compact = false }) => {
    const id = bannerId(banner);
    const busy = Boolean(busyIds[id]);
    const ended = bannerStatus(banner, now).key === 'ended';
    const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition disabled:opacity-50';
    return (
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1 border-t border-border bg-slate-50/80 px-2 py-1.5'}`}>
        <button type="button" onClick={() => openEdit(banner)} className={`${btn} text-primary-700 hover:bg-primary-50`}>
          <Pencil className="h-3.5 w-3.5" />
          {!compact && (isAr ? 'تعديل' : 'Edit')}
        </button>
        {!ended && (
          <button type="button" disabled={busy} onClick={() => toggleActive(banner)} className={`${btn} hover:bg-white`}>
            {banner.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {!compact && (banner.isActive ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تشغيل' : 'Turn on'))}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => duplicate(banner)}
          className={`${btn} hover:bg-white`}
          title={isAr ? 'نسخ' : 'Duplicate'}
          aria-label={isAr ? 'نسخ' : 'Duplicate'}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {canReorder && !ended && (
          <>
            <button type="button" disabled={index === 0} onClick={() => move(placement, list, index, -1)} className={`${btn} hover:bg-white`} aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={index === list.length - 1} onClick={() => move(placement, list, index, 1)} className={`${btn} hover:bg-white`} aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => remove(banner)}
          className={`${btn} ms-auto text-red-600 hover:bg-red-50`}
          aria-label={isAr ? 'حذف' : 'Delete'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderWarnings = (banner) => {
    const list = warningsById[bannerId(banner)] || [];
    if (!list.length || bannerStatus(banner, now).key === 'ended') return null;
    return (
      <ul className="space-y-0.5">
        {list.map((key) => (
          <li key={key} className="flex items-start gap-1 text-[11px] text-amber-700">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            {isAr ? WARNING_TEXT[key].ar : WARNING_TEXT[key].en}
          </li>
        ))}
      </ul>
    );
  };

  const titleOf = (banner) => (isAr ? banner.titleAr || banner.titleEn : banner.titleEn || banner.titleAr) || (isAr ? 'بدون عنوان' : 'Untitled');

  const dragProps = (banner, placement, list) => (canReorder && bannerStatus(banner, now).key !== 'ended' ? {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; setDragging({ id: bannerId(banner), placement }); },
    onDragEnd: () => setDragging(null),
    onDragOver: (e) => { if (dragging?.placement === placement) e.preventDefault(); },
    onDrop: (e) => { e.preventDefault(); dropOn(placement, list, bannerId(banner)); },
  } : {});

  const renderCard = (banner, ctx) => {
    const id = bannerId(banner);
    const audience = audienceMeta(banner.targetAudience);
    const meta = BANNER_PLACEMENTS.find((p) => p.value === banner.placement) || BANNER_PLACEMENTS[0];
    return (
      <article
        key={id}
        {...dragProps(banner, ctx.placement, ctx.list)}
        className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
          selected.has(id) ? 'border-primary-400 ring-2 ring-primary-200' : 'border-border'
        } ${dragging?.id === id ? 'opacity-40' : ''}`}
      >
        <div className="relative">
          <button type="button" onClick={() => openEdit(banner)} className="block w-full" aria-label={`${isAr ? 'تعديل' : 'Edit'} ${titleOf(banner)}`}>
            <BannerThumb
              banner={banner}
              broken={brokenImages[id]}
              onBroken={() => setBrokenImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }))}
              className={`w-full ${meta.previewAspect}`}
            />
          </button>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <StatusChip banner={banner} isAr={isAr} now={now} />
            <div className="pointer-events-auto flex items-center gap-1">
              {canReorder && bannerStatus(banner, now).key !== 'ended' && (
                <span className="cursor-grab rounded-md bg-white/90 p-1 text-text-muted shadow-sm" title={isAr ? 'اسحب لتغيير الترتيب' : 'Drag to reorder'}>
                  <GripVertical className="h-4 w-4" />
                </span>
              )}
              <label className="flex cursor-pointer items-center rounded-md bg-white/90 p-1.5 shadow-sm">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggleSelect(id)}
                  aria-label={isAr ? 'تحديد' : 'Select'}
                />
              </label>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 p-3.5">
          <p className="line-clamp-1 font-bold">{titleOf(banner)}</p>
          <p className="text-xs text-text-muted">{statusDetail(banner, isAr, now)}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{linkLabel(banner.link)}</span>
            </span>
            {banner.targetAudience !== 'all' && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {isAr ? audience.labelAr : audience.labelEn}
              </span>
            )}
          </div>
          {banner.usedIn?.length > 0 && (
            <p className="text-[11px] text-primary-700">
              {isAr ? 'مختار يدوياً في: ' : 'Hand-picked in: '}
              {banner.usedIn.map((s) => sectionName(s, isAr)).join(isAr ? '، ' : ', ')}
            </p>
          )}
          {renderWarnings(banner)}
        </div>
        {renderActions(banner, ctx)}
      </article>
    );
  };

  const renderRow = (banner, ctx) => {
    const id = bannerId(banner);
    return (
      <div
        key={id}
        {...dragProps(banner, ctx.placement, ctx.list)}
        className={`flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 sm:flex-nowrap ${
          selected.has(id) ? 'bg-primary-50/60' : 'bg-white'
        } ${dragging?.id === id ? 'opacity-40' : ''}`}
      >
        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} aria-label={isAr ? 'تحديد' : 'Select'} />
        <button type="button" onClick={() => openEdit(banner)} className="shrink-0">
          <BannerThumb
            banner={banner}
            broken={brokenImages[id]}
            onBroken={() => setBrokenImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }))}
            className="h-12 w-24 rounded-lg"
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{titleOf(banner)}</p>
          <p className="truncate text-xs text-text-muted">
            {statusDetail(banner, isAr, now)} · {linkLabel(banner.link)}
            {(warningsById[id]?.length > 0 && bannerStatus(banner, now).key !== 'ended') && (
              <span className="ms-1 text-amber-700">· ⚠ {warningsById[id].length}</span>
            )}
          </p>
        </div>
        <StatusChip banner={banner} isAr={isAr} now={now} />
        {renderActions(banner, { ...ctx, compact: true })}
      </div>
    );
  };

  const renderGroup = (placementMeta) => {
    const placement = placementMeta.value;
    const all = groups[placement] || [];
    if (!all.length) return null;
    const current = all.filter((b) => bannerStatus(b, now).key !== 'ended');
    const ended = all.filter((b) => bannerStatus(b, now).key === 'ended');
    const sections = (placementSections?.[placement] || []).filter((s) => s.isActive);
    const render = view === 'list' ? renderRow : renderCard;
    const wrap = (items, list) => (view === 'list'
      ? <div className="overflow-hidden rounded-2xl border border-border">{items.map((b, i) => render(b, { list, index: i, placement }))}</div>
      : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((b, i) => render(b, { list, index: i, placement }))}</div>);

    return (
      <section key={placement} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-text">
              {isAr ? placementMeta.labelAr : placementMeta.labelEn}
              <span className="ms-2 text-sm font-normal text-text-muted">{all.length}</span>
            </h3>
            <p className="text-xs text-text-muted">
              {placement === 'promo'
                ? (isAr ? 'تظهر في صفحة العروض' : 'Shown on the Offers page')
                : ''}
              {sections.length > 0 && (
                <>
                  {placement === 'promo' ? (isAr ? ' وفي: ' : ' and in: ') : (isAr ? 'تظهر في: ' : 'Shown in: ')}
                  {sections.map((s) => sectionName(s, isAr)).join(isAr ? '، ' : ', ')}
                </>
              )}
              {placementSections && placement !== 'promo' && !sections.length && (
                <span className="text-amber-700">
                  {isAr ? 'لا يوجد قسم في الصفحة الرئيسية يعرض هذه البانرات تلقائياً' : 'No homepage section shows these automatically'}
                </span>
              )}
            </p>
          </div>
          {canReorder && current.length > 1 && (
            <p className="text-[11px] text-text-muted">
              {isAr ? 'الترتيب هنا = ترتيب الظهور. اسحب للتغيير.' : 'This order is the display order. Drag to change.'}
            </p>
          )}
        </div>
        {current.length > 0 && wrap(current, current)}
        {ended.length > 0 && (
          <details className="rounded-2xl border border-dashed border-border bg-white/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-muted">
              {isAr ? `بانرات انتهت (${ended.length})` : `Ended banners (${ended.length})`}
            </summary>
            <div className="mt-3">{wrap(ended, ended)}</div>
          </details>
        )}
      </section>
    );
  };

  const summary = [
    { key: 'live', value: counts.live },
    { key: 'scheduled', value: counts.scheduled },
    { key: 'paused', value: counts.paused },
    { key: 'ended', value: counts.ended },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr
          ? 'البانرات التي تظهر في الصفحة الرئيسية وصفحة العروض. اضغط على أي بانر لتعديله.'
          : 'Banners on the homepage and the Offers page. Click any banner to edit it.'}
        action={<Button onClick={openCreate}>{isAr ? '+ بانر جديد' : '+ New banner'}</Button>}
      />

      <BannerEditorModal
        open={editor.open}
        isAr={isAr}
        banner={editor.banner}
        allBanners={banners}
        categories={categories}
        placementSections={placementSections}
        saving={saving}
        onClose={closeEditor}
        onSave={saveBanner}
      />

      {!loading && banners.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.map(({ key, value }) => {
              const meta = STATUS_META[key];
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(active ? 'all' : key)}
                  aria-pressed={active}
                  className={`rounded-2xl border bg-white p-3 text-start transition hover:shadow-sm ${active ? 'border-primary-400 ring-2 ring-primary-200' : 'border-border'}`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {isAr ? meta.labelAr : meta.labelEn}
                  </span>
                  <span className="mt-1 block text-2xl font-bold text-text">{value}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'attention' ? 'all' : 'attention')}
              aria-pressed={statusFilter === 'attention'}
              className={`rounded-2xl border p-3 text-start transition hover:shadow-sm ${
                statusFilter === 'attention' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-border'
              } ${attentionCount ? 'bg-amber-50' : 'bg-white'}`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {isAr ? 'تحتاج مراجعة' : 'Needs attention'}
              </span>
              <span className="mt-1 block text-2xl font-bold text-text">{attentionCount}</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث بالعنوان أو الرابط...' : 'Search by title or link...'}
                aria-label={isAr ? 'بحث' : 'Search'}
                className="w-full rounded-xl border border-border py-2 ps-9 pe-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[{ value: 'all', labelAr: 'كل الأماكن', labelEn: 'All places' }, ...BANNER_PLACEMENTS].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPlacementFilter(tab.value)}
                  aria-pressed={placementFilter === tab.value}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    placementFilter === tab.value ? 'bg-primary-600 text-white' : 'border border-border bg-white hover:bg-surface-muted'
                  }`}
                >
                  {isAr ? tab.labelAr : tab.labelEn}
                </button>
              ))}
              <div className="flex rounded-xl border border-border p-0.5">
                {[{ v: 'cards', Icon: LayoutGrid, ar: 'بطاقات', en: 'Cards' }, { v: 'list', Icon: List, ar: 'قائمة', en: 'List' }].map(({ v, Icon, ar, en }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => changeView(v)}
                    aria-pressed={view === v}
                    aria-label={isAr ? ar : en}
                    title={isAr ? ar : en}
                    className={`rounded-lg p-1.5 ${view === v ? 'bg-slate-800 text-white' : 'text-text-muted hover:bg-slate-100'}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtersActive && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>
                {isAr ? `يظهر ${visible.length} من ${banners.length}` : `Showing ${visible.length} of ${banners.length}`}
                {' · '}
                {isAr ? 'الترتيب متاح بدون فلاتر' : 'Clear filters to reorder'}
              </span>
              <button
                type="button"
                onClick={() => { setSearch(''); setPlacementFilter('all'); setStatusFilter('all'); }}
                className="font-semibold text-primary-700 hover:underline"
              >
                {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : banners.length === 0 ? (
        <EmptyState
          icon={Image}
          title={isAr ? 'لا توجد بانرات' : 'No banners yet'}
          description={isAr ? 'أضف بانراً للصفحة الرئيسية أو صفحة العروض' : 'Add a banner for the homepage or the Offers page'}
          action={<Button size="sm" onClick={openCreate}>{isAr ? 'بانر جديد' : 'New banner'}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={isAr ? 'لا توجد بانرات مطابقة' : 'No matching banners'}
          description={isAr ? 'جرّب فلتراً آخر' : 'Try another filter'}
        />
      ) : (
        <div className="space-y-8">{BANNER_PLACEMENTS.map(renderGroup)}</div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
          <span className="font-semibold">{isAr ? `${selected.size} محدد` : `${selected.size} selected`}</span>
          <button type="button" onClick={() => bulkSetActive(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 hover:bg-white/10">
            <Play className="h-3.5 w-3.5" />
            {isAr ? 'تشغيل' : 'Turn on'}
          </button>
          <button type="button" onClick={() => bulkSetActive(false)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 hover:bg-white/10">
            <Pause className="h-3.5 w-3.5" />
            {isAr ? 'إيقاف' : 'Pause'}
          </button>
          <button type="button" onClick={bulkDelete} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-red-300 hover:bg-white/10">
            <Trash2 className="h-3.5 w-3.5" />
            {isAr ? 'حذف' : 'Delete'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg p-1.5 hover:bg-white/10" aria-label={isAr ? 'إلغاء التحديد' : 'Clear selection'}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
