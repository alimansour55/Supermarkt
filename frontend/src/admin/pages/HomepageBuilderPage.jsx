import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Plus, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { homepageAdminApi } from '../homepageAdminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { emptyHomepageForm, formFromSection } from '../components/HomepageSectionForm';
import HomepageSectionTypePicker from '../components/HomepageSectionTypePicker';
import HomepageOutline from '../components/homepage/HomepageOutline';
import HomepagePreviewFrame from '../components/homepage/HomepagePreviewFrame';
import HomepageHealthBar from '../components/homepage/HomepageHealthBar';
import HomepageSectionEditor, { DeviceToggle } from '../components/homepage/HomepageSectionEditor';
import { applySectionTypeDefaults } from '../utils/homepageSectionMeta';
import {
  PREVIEW_AUDIENCES,
  STATUS_META,
  moveSection,
  pageIssues,
  sectionStatus,
  sectionsForPreview,
  sortOrderForInsert,
} from '../utils/homepageBuilderRules';
import { sectionContentIssue, sectionDisplayName } from '../utils/homepageSectionSummary';
import { storeInputToDate } from '../utils/bannerAdmin';
import { sectionDevices } from '../../utils/homepageVisibility';
import useAdminHeaderHeight from '../hooks/useAdminHeaderHeight';

const UNDO_MS = 7000;
const CLOCK_TICK_MS = 60_000;

function sortSections(list) {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a._id).localeCompare(String(b._id)));
}

function upsertSection(list, updated) {
  if (!updated?._id) return sortSections(list);
  const exists = list.some((s) => s._id === updated._id);
  return sortSections(exists ? list.map((s) => (s._id === updated._id ? updated : s)) : [...list, updated]);
}

export default function HomepageBuilderPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();

  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editor, setEditor] = useState(null); // { form, id }
  const [typePickerAt, setTypePickerAt] = useState(null); // sortOrder for the new section
  const [selectedId, setSelectedId] = useState(null);
  const [scrollRequest, setScrollRequest] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // { section, index }
  const [now, setNow] = useState(() => new Date());

  // Preview controls
  const [device, setDevice] = useState('desktop');
  const [previewAudience, setPreviewAudience] = useState('any');
  const [previewZone, setPreviewZone] = useState('');
  const [previewAt, setPreviewAt] = useState('');
  const [showHidden, setShowHidden] = useState(true);

  const deleteTimer = useRef(null);
  const headerHeight = useAdminHeaderHeight();
  const pendingRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [sectionRes, categoryRes, zoneRes] = await Promise.all([
        homepageAdminApi.list(),
        adminApi.getCategories({ page: 1, limit: 200 }),
        homepageAdminApi.zones().catch(() => ({ data: { data: [] } })),
      ]);
      setSections(sortSections(sectionRes.data.data || []));
      setCategories(categoryRes.data.data || []);
      setZones(zoneRes.data.data || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Statuses like "Starts in 2 hours" stay current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  /* ── Delete with undo: the section disappears now, the server delete runs after a few seconds. ── */
  const flushDelete = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(deleteTimer.current);
    pendingRef.current = null;
    setPendingDelete(null);
    try {
      await homepageAdminApi.remove(pending.section._id);
    } catch {
      // Put it back where it was — nothing was lost.
      setSections((prev) => (prev.some((s) => s._id === pending.section._id) ? prev : sortSections([...prev, pending.section])));
      toast.error(isAr ? 'تعذر حذف القسم — أعدناه' : 'Could not delete the section — it was put back');
    }
  }, [isAr, toast]);

  // Leaving the page finishes a pending delete instead of dropping it.
  const flushRef = useRef(flushDelete);
  useEffect(() => { flushRef.current = flushDelete; }, [flushDelete]);
  useEffect(() => () => { flushRef.current(); }, []);

  const handleDelete = (section) => {
    if (pendingRef.current) flushDelete();
    setSections((prev) => prev.filter((s) => s._id !== section._id));
    const pending = { section };
    pendingRef.current = pending;
    setPendingDelete(pending);
    if (selectedId === section._id) setSelectedId(null);
    deleteTimer.current = setTimeout(flushDelete, UNDO_MS);
  };

  const undoDelete = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(deleteTimer.current);
    pendingRef.current = null;
    setPendingDelete(null);
    setSections((prev) => sortSections([...prev, pending.section]));
    setSelectedId(pending.section._id);
  };

  /* ── Quick actions ── */
  const patchSection = async (section, patch) => {
    const previous = sections;
    setBusyId(section._id);
    setSections((prev) => prev.map((s) => (s._id === section._id ? { ...s, ...patch } : s)));
    try {
      const res = await homepageAdminApi.update(section._id, patch);
      if (res.data?.data) setSections((prev) => upsertSection(prev, res.data.data));
    } catch (error) {
      setSections(previous);
      toast.error(error.response?.data?.message || (isAr ? 'تعذر تحديث القسم' : 'Could not update section'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = (section) => {
    patchSection(section, { isActive: !section.isActive });
    toast.success(section.isActive
      ? (isAr ? 'أُخفي القسم من المتجر' : 'Section hidden from the store')
      : (isAr ? 'القسم ظاهر في المتجر' : 'Section is on the store'));
  };

  const reorder = async (from, to) => {
    const previous = sections;
    const next = moveSection(sections, from, to);
    if (next === sections) return;
    setSections(next);
    setReordering(true);
    try {
      const { data } = await homepageAdminApi.reorder(next.map((s) => s._id));
      setSections(sortSections(data.data || next));
    } catch {
      setSections(previous);
      toast.error(isAr ? 'تعذر حفظ الترتيب' : 'Could not save the order');
    } finally {
      setReordering(false);
    }
  };

  const duplicate = async (section) => {
    setBusyId(section._id);
    try {
      const { data } = await homepageAdminApi.duplicate(section._id);
      setSections(sortSections(data.data || []));
      setSelectedId(data.createdId || null);
      toast.success(isAr ? 'أُضيفت نسخة أسفله — مخفية حتى تُظهرها' : 'Copy added below — hidden until you show it');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر نسخ القسم' : 'Could not copy the section'));
    } finally {
      setBusyId(null);
    }
  };

  /* ── Editor ── */
  const openEditor = useCallback((section) => {
    setSelectedId(section._id);
    setEditor({ form: formFromSection(section), id: section._id });
    window.scrollTo({ top: 0 });
  }, []);

  const openById = useCallback((id) => {
    const section = sections.find((s) => s._id === id);
    if (section) openEditor(section);
  }, [sections, openEditor]);

  const startCreate = (type) => {
    const sortOrder = typePickerAt ?? (sections.length ? (sections[sections.length - 1].sortOrder ?? 0) + 10 : 10);
    setTypePickerAt(null);
    setEditor({ form: applySectionTypeDefaults({ ...emptyHomepageForm, sortOrder }, type), id: null });
    window.scrollTo({ top: 0 });
  };

  const saveSection = async (payload) => {
    const res = editor.id
      ? await homepageAdminApi.update(editor.id, payload)
      : await homepageAdminApi.create(payload);
    const saved = res.data?.data;
    if (saved) {
      setSections((prev) => upsertSection(prev, saved));
      setSelectedId(saved._id);
    } else {
      await load();
    }
    toast.success(editor.id ? (isAr ? 'تم حفظ القسم' : 'Section saved') : (isAr ? 'أُضيف القسم' : 'Section added'));
    setEditor(null);
  };

  /* ── Preview ── */
  const previewTime = useMemo(() => (previewAt ? storeInputToDate(previewAt) : null), [previewAt]);
  const previewSections = useMemo(
    () => sectionsForPreview(sections, { audience: previewAudience, zoneId: previewZone, at: previewTime, showHidden })
      .filter((s) => previewAudience === 'any' || sectionDevices(s) === 'all' || sectionDevices(s) === device),
    [sections, previewAudience, previewZone, previewTime, showHidden, device],
  );

  const previewNotes = useMemo(() => {
    const at = previewTime || now;
    const notes = {};
    previewSections.forEach((section) => {
      const status = sectionStatus(section, at);
      const devices = sectionDevices(section);
      const offDevice = devices !== 'all' && devices !== device;
      let label = '';
      if (status !== 'live') label = isAr ? STATUS_META[status].labelAr : STATUS_META[status].labelEn;
      else if (offDevice) label = device === 'mobile' ? (isAr ? 'لا يظهر على الموبايل' : 'Not shown on phones') : (isAr ? 'لا يظهر على الكمبيوتر' : 'Not shown on computers');
      notes[section._id] = {
        name: sectionDisplayName(section, isAr),
        label,
        dim: status !== 'live' || offDevice,
      };
    });
    return notes;
  }, [previewSections, previewTime, now, device, isAr]);

  const locate = (section) => {
    setSelectedId(section._id);
    setScrollRequest({ id: section._id, at: Date.now() });
  };

  /* ── Health ── */
  const issues = useMemo(() => pageIssues(sections, isAr, {
    now,
    zones,
    contentIssue: (section) => sectionContentIssue(section, isAr),
  }).map((issue) => {
    const section = sections.find((s) => s._id === issue.sectionId);
    return { ...issue, name: section ? sectionDisplayName(section, isAr) : '' };
  }), [sections, isAr, now, zones]);
  const liveCount = useMemo(() => sections.filter((s) => sectionStatus(s, now) === 'live').length, [sections, now]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white text-center">
        <p className="text-sm text-text-muted">{isAr ? 'تعذر تحميل الصفحة الرئيسية' : 'Could not load the homepage builder'}</p>
        <Button type="button" variant="secondary" onClick={load}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {isAr ? 'حاول مرة أخرى' : 'Try again'}
        </Button>
      </div>
    );
  }

  if (editor) {
    return (
      <HomepageSectionEditor
        key={editor.id || 'new'}
        initialForm={editor.form}
        editId={editor.id}
        categories={categories}
        zones={zones}
        isAr={isAr}
        onSave={saveSection}
        onClose={() => setEditor(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        description={isAr
          ? 'رتّب أقسام الصفحة الرئيسية، وحدد متى تظهر ولمن، وشاهد النتيجة كما يراها الزائر.'
          : 'Arrange the homepage, choose when each section shows and to whom, and see it the way visitors do.'}
        action={(
          <div className="flex flex-wrap gap-2">
            <a
              href={isAr ? '/ar' : '/en'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text hover:bg-surface-muted"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {isAr ? 'فتح المتجر' : 'View store'}
            </a>
            <Button type="button" onClick={() => setTypePickerAt(sortOrderForInsert(sections, sections.length - 1))} disabled={reordering}>
              <Plus className="h-4 w-4" aria-hidden />
              {isAr ? 'إضافة قسم' : 'Add section'}
            </Button>
          </div>
        )}
      />

      <HomepageHealthBar issues={issues} liveCount={liveCount} total={sections.length} isAr={isAr} onOpen={openById} />

      {typePickerAt !== null && (
        <HomepageSectionTypePicker onSelect={startCreate} onClose={() => setTypePickerAt(null)} />
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <div
          className="xl:sticky xl:top-[calc(var(--admin-header)+1rem)] xl:flex xl:max-h-[calc(100vh-var(--admin-header)-2rem)] xl:flex-col"
          style={{ '--admin-header': `${headerHeight}px` }}
        >
          <HomepageOutline
            sections={sections}
            isAr={isAr}
            zones={zones}
            now={now}
            selectedId={selectedId}
            busyId={busyId}
            reordering={reordering}
            onReorder={reorder}
            onEdit={openEditor}
            onLocate={locate}
            onToggleActive={toggleActive}
            onDuplicate={duplicate}
            onDelete={handleDelete}
            onAddAt={(index) => setTypePickerAt(sortOrderForInsert(sections, index))}
          />
          {reordering && (
            <p className="mt-2 text-center text-xs font-medium text-primary-600">{isAr ? 'جار حفظ الترتيب…' : 'Saving the order…'}</p>
          )}
        </div>

        <section className="min-w-0 space-y-3" aria-label={isAr ? 'المعاينة' : 'Preview'}>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2.5 shadow-sm">
            <DeviceToggle device={device} onChange={setDevice} isAr={isAr} />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
              {isAr ? 'معاينة كـ' : 'Preview as'}
              <select
                value={previewAudience}
                onChange={(e) => setPreviewAudience(e.target.value)}
                className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold text-text"
              >
                {PREVIEW_AUDIENCES.map((o) => <option key={o.value} value={o.value}>{isAr ? o.labelAr : o.labelEn}</option>)}
              </select>
            </label>
            {previewAudience !== 'any' && (
              <>
                {zones.length > 0 && (
                  <select
                    value={previewZone}
                    onChange={(e) => setPreviewZone(e.target.value)}
                    className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold text-text"
                    aria-label={isAr ? 'منطقة التوصيل' : 'Delivery zone'}
                  >
                    <option value="">{isAr ? 'أي منطقة' : 'Any zone'}</option>
                    {zones.map((z) => (
                      <option key={z.id || z._id} value={String(z.id || z._id)}>{isAr ? z.nameAr || z.nameEn : z.nameEn || z.nameAr}</option>
                    ))}
                  </select>
                )}
                <input
                  type="datetime-local"
                  value={previewAt}
                  onChange={(e) => setPreviewAt(e.target.value)}
                  className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-text"
                  aria-label={isAr ? 'في وقت' : 'At time'}
                  title={isAr ? 'اتركه فارغاً للآن (بتوقيت القاهرة)' : 'Leave empty for now (Cairo time)'}
                />
                {previewAt && (
                  <button type="button" onClick={() => setPreviewAt('')} className="text-xs font-semibold text-primary-700 hover:underline">
                    {isAr ? 'الآن' : 'Now'}
                  </button>
                )}
              </>
            )}
            {previewAudience === 'any' && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                <input type="checkbox" className="accent-primary-600" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                {isAr ? 'إظهار الأقسام المخفية' : 'Show hidden sections'}
              </label>
            )}
            <span className="ms-auto text-xs text-text-muted">
              {isAr ? `${previewSections.length} قسم` : `${previewSections.length} section${previewSections.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="rounded-2xl bg-slate-100 p-3 sm:p-4">
            {previewSections.length === 0 ? (
              <p className="py-16 text-center text-sm text-text-muted">
                {isAr ? 'لن يرى هذا الزائر أي قسم في هذا الوقت.' : 'This visitor would see no sections at this time.'}
              </p>
            ) : (
              <HomepagePreviewFrame
                sections={previewSections}
                device={device}
                selectedId={selectedId}
                notes={previewNotes}
                onSelect={openById}
                scrollRequest={scrollRequest}
                title={isAr ? 'معاينة الصفحة الرئيسية' : 'Homepage preview'}
              />
            )}
          </div>
          <p className="text-center text-xs text-text-muted">
            {isAr ? 'اضغط على أي قسم في المعاينة لتعديله.' : 'Click any section in the preview to edit it.'}
          </p>
        </section>
      </div>

      {pendingDelete && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status">
          <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
            <span>
              {isAr ? 'حُذف' : 'Deleted'} «{sectionDisplayName(pendingDelete.section, isAr)}»
            </span>
            <button type="button" onClick={undoDelete} className="rounded-lg bg-white/10 px-3 py-1 font-bold hover:bg-white/20">
              {isAr ? 'تراجع' : 'Undo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
