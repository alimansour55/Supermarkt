import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Loader from '../../components/ui/Loader';
import ContentPageEditorPanel from '../components/ContentPageEditorPanel';
import { PageHeader, useToast } from '../components';
import { normalizePageForm, PAGE_LABELS } from '../utils/navigationHelpers';

function normalizePage(data) {
  return normalizePageForm(data);
}

export default function ContentPagesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [pages, setPages] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getContentPages();
      const list = data.data || [];
      setPages(list);
      setSelectedSlug((prev) => prev || list[0]?.slug || null);
    } catch {
      toast.error(isAr ? 'تعذر تحميل الصفحات' : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    if (!selectedSlug) return;
    const page = pages.find((p) => p.slug === selectedSlug);
    if (page) setForm(normalizePage(page));
  }, [selectedSlug, pages]);

  const handleSave = async () => {
    if (!form?.slug) return;
    setSaving(true);
    try {
      const { data } = await adminApi.updateContentPage(form.slug, {
        ...form,
        sections: form.sections.map((s, i) => ({ ...s, sortOrder: i })),
      });
      setPages((prev) => prev.map((p) => (p.slug === data.data.slug ? data.data : p)));
      setForm(normalizePage(data.data));
      toast.success(isAr ? 'تم حفظ الصفحة' : 'Page saved');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !pages.length) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'صفحات المحتوى' : 'Content pages'}
        description={isAr ? 'تحرير صفحات الموقع ثنائية اللغة وإعدادات SEO' : 'Edit bilingual site pages and SEO settings'}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1 rounded-2xl border border-border bg-white p-3">
          {pages.map((page) => {
            const label = PAGE_LABELS[page.slug];
            return (
              <button
                key={page.slug}
                type="button"
                onClick={() => setSelectedSlug(page.slug)}
                className={[
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors',
                  selectedSlug === page.slug
                    ? 'bg-primary-600 text-white'
                    : 'text-text hover:bg-slate-50',
                ].join(' ')}
              >
                <FileText className="h-4 w-4 shrink-0" />
                {label ? (isAr ? label.ar : label.en) : page.slug}
              </button>
            );
          })}
        </aside>

        {form ? (
          <div className="rounded-2xl border border-border bg-white p-6">
            <ContentPageEditorPanel
              form={form}
              onChange={setForm}
              onSave={handleSave}
              saving={saving}
              isAr={isAr}
              compact={false}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-white p-12 text-center text-text-muted">
            {isAr ? 'اختر صفحة للتحرير' : 'Select a page to edit'}
          </div>
        )}
      </div>
    </div>
  );
}
