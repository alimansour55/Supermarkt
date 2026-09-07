import { useCallback, useEffect, useState } from 'react';
import { Bell, RefreshCw, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';

function normalizeTemplate(data) {
  return {
    key: data.key,
    nameAr: data.nameAr || '',
    nameEn: data.nameEn || '',
    channel: data.channel || 'email',
    subjectAr: data.subjectAr || '',
    subjectEn: data.subjectEn || '',
    bodyHtmlAr: data.bodyHtmlAr || '',
    bodyHtmlEn: data.bodyHtmlEn || '',
    bodyTextAr: data.bodyTextAr || '',
    bodyTextEn: data.bodyTextEn || '',
    smsBodyAr: data.smsBodyAr || '',
    smsBodyEn: data.smsBodyEn || '',
    placeholders: data.placeholders || [],
    isActive: data.isActive !== false,
  };
}

export default function NotificationTemplatesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getNotificationTemplates();
      const list = data.data || [];
      setTemplates(list);
      setSelectedKey((prev) => prev || list[0]?.key || null);
    } catch {
      toast.error(isAr ? 'تعذر تحميل القوالب' : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const template = templates.find((t) => t.key === selectedKey);
    if (template) setForm(normalizeTemplate(template));
  }, [selectedKey, templates]);

  const handleSeed = async () => {
    try {
      const { data } = await adminApi.seedNotificationTemplates();
      setTemplates(data.data || []);
      toast.success(isAr ? 'تم استيراد القوالب الافتراضية' : 'Default templates seeded');
    } catch {
      toast.error(isAr ? 'تعذر الاستيراد' : 'Seed failed');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form?.key) return;
    setSaving(true);
    try {
      const { data } = await adminApi.updateNotificationTemplate(form.key, form);
      setTemplates((prev) => prev.map((t) => (t.key === form.key ? data.data : t)));
      setForm(normalizeTemplate(data.data));
      toast.success(isAr ? 'تم حفظ القالب' : 'Template saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[320px] items-center justify-center"><Loader size="lg" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader action={(
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleSeed}>
            <RefreshCw className="h-4 w-4" />
            {isAr ? 'استيراد افتراضي' : 'Seed defaults'}
          </Button>
        </div>
      )} />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-text-muted">
            <Bell className="h-4 w-4" />
            {isAr ? 'القوالب' : 'Templates'}
          </div>
          <ul className="space-y-1">
            {templates.map((template) => (
              <li key={template.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(template.key)}
                  className={`w-full rounded-xl px-3 py-2 text-start text-sm ${selectedKey === template.key ? 'bg-primary-50 font-semibold text-primary-700' : 'hover:bg-surface'}`}
                >
                  {isAr ? template.nameAr || template.key : template.nameEn || template.key}
                  <span className="mt-0.5 block text-[10px] uppercase text-text-muted">{template.channel}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {form && (
          <form onSubmit={handleSave} className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">{form.key}</h2>
                <p className="text-sm text-text-muted">{form.channel === 'sms' ? 'SMS' : 'Email'} · {form.placeholders?.join(', ')}</p>
              </div>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4" />{isAr ? 'حفظ' : 'Save'}</Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              {isAr ? 'نشط' : 'Active'}
            </label>
            {form.channel === 'email' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label={isAr ? 'الموضوع (عربي)' : 'Subject AR'} value={form.subjectAr} onChange={(e) => setForm({ ...form, subjectAr: e.target.value })} />
                  <Input label={isAr ? 'الموضوع (EN)' : 'Subject EN'} value={form.subjectEn} onChange={(e) => setForm({ ...form, subjectEn: e.target.value })} />
                </div>
                <Textarea label={isAr ? 'HTML (عربي)' : 'HTML AR'} rows={6} value={form.bodyHtmlAr} onChange={(e) => setForm({ ...form, bodyHtmlAr: e.target.value })} />
                <Textarea label={isAr ? 'HTML (EN)' : 'HTML EN'} rows={6} value={form.bodyHtmlEn} onChange={(e) => setForm({ ...form, bodyHtmlEn: e.target.value })} />
                <Textarea label={isAr ? 'نص عادي (عربي)' : 'Plain text AR'} rows={3} value={form.bodyTextAr} onChange={(e) => setForm({ ...form, bodyTextAr: e.target.value })} />
                <Textarea label={isAr ? 'نص عادي (EN)' : 'Plain text EN'} rows={3} value={form.bodyTextEn} onChange={(e) => setForm({ ...form, bodyTextEn: e.target.value })} />
              </>
            ) : (
              <>
                <Textarea label={isAr ? 'SMS (عربي)' : 'SMS AR'} rows={4} value={form.smsBodyAr} onChange={(e) => setForm({ ...form, smsBodyAr: e.target.value })} />
                <Textarea label={isAr ? 'SMS (EN)' : 'SMS EN'} rows={4} value={form.smsBodyEn} onChange={(e) => setForm({ ...form, smsBodyEn: e.target.value })} />
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
