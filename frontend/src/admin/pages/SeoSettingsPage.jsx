import { useEffect, useState } from 'react';
import { Save, Globe2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';

const emptySeo = {
  defaultTitleAr: '',
  defaultTitleEn: '',
  defaultDescriptionAr: '',
  defaultDescriptionEn: '',
  ogImageUrl: '',
  robotsIndex: true,
  googleAnalyticsId: '',
  facebookPixelId: '',
};

export default function SeoSettingsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [seo, setSeo] = useState(emptySeo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getStoreSettings()
      .then(({ data }) => setSeo({ ...emptySeo, ...(data.data?.seo || {}) }))
      .catch(() => toast.error(isAr ? 'تعذر التحميل' : 'Load failed'))
      .finally(() => setLoading(false));
  }, [isAr, toast]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append('settings', JSON.stringify({ seo }));
      await adminApi.updateStoreSettings(form);
      toast.success(isAr ? 'تم حفظ SEO' : 'SEO settings saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[320px] items-center justify-center"><Loader size="lg" /></div>;

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader action={<Button type="submit" disabled={saving}><Save className="h-4 w-4" />{isAr ? 'حفظ' : 'Save'}</Button>} />
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <Globe2 className="h-5 w-5 text-primary-600" />
          <div>
            <h2 className="font-bold">{isAr ? 'SEO عام للموقع' : 'Site-wide SEO'}</h2>
            <p className="text-sm text-text-muted">{isAr ? 'العناوين والوصف الافتراضي والتتبع' : 'Default meta tags and tracking IDs'}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'العنوان الافتراضي (عربي)' : 'Default title AR'} value={seo.defaultTitleAr} onChange={(e) => setSeo({ ...seo, defaultTitleAr: e.target.value })} />
          <Input label={isAr ? 'العنوان الافتراضي (EN)' : 'Default title EN'} value={seo.defaultTitleEn} onChange={(e) => setSeo({ ...seo, defaultTitleEn: e.target.value })} />
          <Textarea label={isAr ? 'الوصف (عربي)' : 'Description AR'} rows={3} value={seo.defaultDescriptionAr} onChange={(e) => setSeo({ ...seo, defaultDescriptionAr: e.target.value })} />
          <Textarea label={isAr ? 'الوصف (EN)' : 'Description EN'} rows={3} value={seo.defaultDescriptionEn} onChange={(e) => setSeo({ ...seo, defaultDescriptionEn: e.target.value })} />
          <Input label={isAr ? 'صورة OG' : 'OG image URL'} value={seo.ogImageUrl} onChange={(e) => setSeo({ ...seo, ogImageUrl: e.target.value })} />
          <Input label="Google Analytics ID" value={seo.googleAnalyticsId} onChange={(e) => setSeo({ ...seo, googleAnalyticsId: e.target.value })} />
          <Input label="Facebook Pixel ID" value={seo.facebookPixelId} onChange={(e) => setSeo({ ...seo, facebookPixelId: e.target.value })} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={seo.robotsIndex} onChange={(e) => setSeo({ ...seo, robotsIndex: e.target.checked })} />
            {isAr ? 'السماح للفهرسة (robots index)' : 'Allow search indexing (robots index)'}
          </label>
        </div>
      </section>
    </form>
  );
}
