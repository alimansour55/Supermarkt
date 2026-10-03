import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useConfirm, useToast } from '../components';
import HomepageSectionForm, {
  emptyHomepageForm,
  formFromSection,
  payloadFromForm,
} from '../components/HomepageSectionForm';
import HomepageSectionsList from '../components/HomepageSectionsList';
import HomepageVisualBuilder from '../components/HomepageVisualBuilder';
import { applySectionTypeDefaults, getSectionTypeMeta } from '../utils/homepageSectionMeta';
import HomepageSectionTypePicker from '../components/HomepageSectionTypePicker';

function sortSections(list) {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a._id).localeCompare(String(b._id)));
}

function upsertSection(list, updated) {
  const id = updated._id;
  if (!id) return sortSections(list);
  const exists = list.some((s) => s._id === id);
  const next = exists
    ? list.map((s) => (s._id === id ? { ...s, ...updated } : s))
    : [...list, updated];
  return sortSections(next);
}

export default function HomepageBuilderPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [busySectionId, setBusySectionId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyHomepageForm);
  const [viewMode, setViewMode] = useState('desktop');
  const [layoutMode, setLayoutMode] = useState('visual');
  const [pendingSortOrder, setPendingSortOrder] = useState(null);

  const refreshSections = useCallback(async () => {
    const sectionRes = await adminApi.getHomepageSections();
    setSections(sortSections(sectionRes.data.data || []));
  }, []);

  const loadInitial = useCallback(async () => {
    setInitialLoading(true);
    try {
      const [sectionRes, categoryRes] = await Promise.all([
        adminApi.getHomepageSections(),
        adminApi.getCategories({ page: 1, limit: 200 }),
      ]);
      setSections(sortSections(sectionRes.data.data || []));
      setCategories(categoryRes.data.data || []);
    } catch {
      toast.error(isAr ? 'تعذر تحميل الصفحة الرئيسية' : 'Could not load homepage builder');
    } finally {
      setInitialLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (showForm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showForm]);

  const openForm = (nextForm, id = null) => {
    setEditId(id);
    setForm(nextForm);
    setShowForm(true);
    setShowTypePicker(false);
  };

  const startInsert = (sortOrder) => {
    setPendingSortOrder(sortOrder);
    setShowTypePicker(true);
  };

  const startCreateWithType = (type) => {
    const sortOrder = pendingSortOrder ?? (sections.length + 1) * 10;
    setPendingSortOrder(null);
    openForm(
      applySectionTypeDefaults(
        { ...emptyHomepageForm, sortOrder },
        type,
      ),
    );
  };

  const startEdit = (section) => {
    openForm(formFromSection(section), section._id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      const res = editId
        ? await adminApi.updateHomepageSection(editId, payload)
        : await adminApi.createHomepageSection(payload);
      const saved = res.data?.data;
      if (saved) {
        setSections((prev) => upsertSection(prev, saved));
      } else {
        await refreshSections();
      }
      toast.success(isAr ? 'تم حفظ القسم' : 'Section saved');
      closeEditor();
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save section'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (section) => {
    const ok = await confirm({
      title: isAr ? 'حذف قسم' : 'Delete section',
      message: isAr ? 'هل تريد حذف هذا القسم من الصفحة الرئيسية؟' : 'Delete this homepage section?',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    const previous = sections;
    setBusySectionId(section._id);
    setSections((prev) => prev.filter((s) => s._id !== section._id));
    if (editId === section._id) closeEditor();

    try {
      await adminApi.deleteHomepageSection(section._id);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch {
      setSections(previous);
      toast.error(isAr ? 'تعذر الحذف' : 'Could not delete section');
    } finally {
      setBusySectionId(null);
    }
  };

  const patchSection = async (section, patch) => {
    const previous = sections;
    setBusySectionId(section._id);
    setSections((prev) => prev.map((s) => (s._id === section._id ? { ...s, ...patch } : s)));

    try {
      const res = await adminApi.updateHomepageSection(section._id, patch);
      const updated = res.data?.data;
      if (updated) {
        setSections((prev) => upsertSection(prev, updated));
      }
    } catch {
      setSections(previous);
      toast.error(isAr ? 'تعذر تحديث القسم' : 'Could not update section');
    } finally {
      setBusySectionId(null);
    }
  };

  const toggleActive = (section) => {
    patchSection(section, { isActive: !section.isActive });
  };

  const toggleMobile = (section) => {
    patchSection(section, { showOnMobile: section.showOnMobile === false });
  };

  const closeEditor = () => {
    setShowForm(false);
    setShowTypePicker(false);
    setEditId(null);
    setForm(emptyHomepageForm);
    setPendingSortOrder(null);
  };

  const backToCmsLabel = isAr ? 'العودة إلى Homepage CMS' : 'Back to Homepage CMS';

  const handleReorder = async (reordered) => {
    const previous = sections;
    setSections(reordered);
    setReordering(true);
    try {
      const { data } = await adminApi.reorderHomepageSections(reordered.map((s) => s._id));
      setSections(sortSections(data.data || reordered));
    } catch {
      setSections(previous);
      toast.error(isAr ? 'تعذر حفظ الترتيب' : 'Could not save order');
    } finally {
      setReordering(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  const editingLabel = editId
    ? (isAr ? 'تعديل القسم' : 'Edit section')
    : (isAr ? 'قسم جديد' : 'New section');
  const typeMeta = getSectionTypeMeta(form.type);

  if (showForm) {
    return (
      <div className="min-h-[calc(100vh-8rem)] space-y-6">
        <PageHeader
          title={editingLabel}
          description={isAr ? typeMeta.descriptionAr : typeMeta.descriptionEn}
          action={(
            <Button type="button" variant="secondary" onClick={closeEditor} disabled={saving}>
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {backToCmsLabel}
            </Button>
          )}
        />
        <div className="mx-auto w-full max-w-5xl pb-10">
          <HomepageSectionForm
            form={form}
            setForm={setForm}
            categories={categories}
            saving={saving}
            editId={editId}
            onSubmit={handleSubmit}
            onCancel={closeEditor}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'Homepage CMS' : 'Homepage CMS'}
        description={
          isAr
            ? 'رتّب أقسام الصفحة الرئيسية وعدّلها من المعاينة المرئية.'
            : 'Arrange and edit homepage sections from the visual preview.'
        }
        action={(
          <Button type="button" onClick={() => startInsert((sections.length) * 10 + 10)} disabled={reordering}>
            <Plus className="h-4 w-4" aria-hidden />
            {isAr ? 'قسم جديد' : 'New section'}
          </Button>
        )}
      />

      {showTypePicker && (
        <HomepageSectionTypePicker
          onSelect={startCreateWithType}
          onClose={() => {
            setShowTypePicker(false);
            setPendingSortOrder(null);
          }}
        />
      )}

      <div className="min-w-0">
        {layoutMode === 'visual' ? (
          <HomepageVisualBuilder
            sections={sections}
            isAr={isAr}
            reordering={reordering}
            busySectionId={busySectionId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onViewList={() => setLayoutMode('list')}
            onInsertAt={(_index, sortOrder) => startInsert(sortOrder)}
            onEdit={startEdit}
            onDelete={handleDelete}
            onToggleActive={toggleActive}
            onToggleMobile={toggleMobile}
            onReorder={handleReorder}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={() => setLayoutMode('visual')}>
                {isAr ? '← المعاينة المرئية' : '← Visual preview'}
              </Button>
            </div>
            <HomepageSectionsList
              sections={sections}
              isAr={isAr}
              reordering={reordering}
              onReorder={handleReorder}
              onEdit={startEdit}
              onDelete={handleDelete}
              onToggleActive={toggleActive}
              onToggleMobile={toggleMobile}
            />
          </div>
        )}

        {reordering && (
          <p className="mt-3 text-center text-xs font-medium text-primary-600">
            {isAr ? 'جار حفظ الترتيب...' : 'Saving order...'}
          </p>
        )}
      </div>
    </div>
  );
}
