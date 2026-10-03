import { ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { PAGE_LABELS } from '../utils/navigationHelpers';

export default function ContentPageEditorPanel({
  form,
  onChange,
  onSave,
  saving = false,
  isAr,
  compact = false,
  showPreview = true,
}) {
  if (!form) return null;

  const updateField = (field, value) => onChange({ ...form, [field]: value });

  const updateSection = (index, field, value) => {
    const sections = [...form.sections];
    sections[index] = { ...sections[index], [field]: value };
    onChange({ ...form, sections });
  };

  const addSection = () => {
    onChange({
      ...form,
      sections: [...form.sections, { headingAr: '', headingEn: '', bodyAr: '', bodyEn: '' }],
    });
  };

  const removeSection = (index) => {
    onChange({ ...form, sections: form.sections.filter((_, i) => i !== index) });
  };

  const pageLabel = PAGE_LABELS[form.slug];
  const previewPath = `/${form.slug}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-text">
            {pageLabel ? (isAr ? pageLabel.ar : pageLabel.en) : form.slug}
          </p>
          <p className="text-xs text-text-muted">
            {isAr ? 'هذا ما يراه العميل بعد النقر على الرابط' : 'This is what customers see after clicking the link'}
            {' · '}
            <code className="rounded bg-slate-100 px-1">{previewPath}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPreview && (
            <a
              href={previewPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? 'معاينة' : 'Preview'}
            </a>
          )}
          {onSave && (
            <Button type="button" size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المحتوى' : 'Save content')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label={isAr ? 'عنوان الصفحة (عربي)' : 'Page title (Arabic)'}
          value={form.titleAr}
          onChange={(e) => updateField('titleAr', e.target.value)}
        />
        <Input
          label={isAr ? 'عنوان الصفحة (EN)' : 'Page title (English)'}
          value={form.titleEn}
          onChange={(e) => updateField('titleEn', e.target.value)}
        />
      </div>

      {!compact && (
        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <h4 className="mb-3 text-sm font-bold text-text">SEO</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'عنوان SEO (عربي)' : 'SEO title (Arabic)'}
              value={form.seoTitleAr}
              onChange={(e) => updateField('seoTitleAr', e.target.value)}
              placeholder={isAr ? 'اتركه فارغًا لاستخدام "عنوان الصفحة — اسم المتجر"' : 'Leave blank to use "Page title — Store name"'}
            />
            <Input
              label={isAr ? 'عنوان SEO (EN)' : 'SEO title (English)'}
              value={form.seoTitleEn}
              onChange={(e) => updateField('seoTitleEn', e.target.value)}
              placeholder={isAr ? 'اتركه فارغًا لاستخدام "عنوان الصفحة — اسم المتجر"' : 'Leave blank to use "Page title — Store name"'}
            />
            <Textarea
              label={isAr ? 'وصف SEO (عربي)' : 'SEO description (Arabic)'}
              rows={2}
              value={form.seoDescriptionAr}
              onChange={(e) => updateField('seoDescriptionAr', e.target.value)}
            />
            <Textarea
              label={isAr ? 'وصف SEO (EN)' : 'SEO description (English)'}
              rows={2}
              value={form.seoDescriptionEn}
              onChange={(e) => updateField('seoDescriptionEn', e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-text">
            {isAr ? 'محتوى الصفحة (أقسام)' : 'Page content (sections)'}
          </h4>
          <Button type="button" size="sm" variant="secondary" onClick={addSection}>
            <Plus className="h-4 w-4" />
            {isAr ? 'قسم' : 'Section'}
          </Button>
        </div>

        <div className="space-y-3">
          {form.sections.map((section, index) => (
            <div key={index} className="rounded-xl border border-border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">
                  {isAr ? `قسم ${index + 1}` : `Section ${index + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                  aria-label={isAr ? 'حذف' : 'Remove'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label={isAr ? 'عنوان فرعي (عربي)' : 'Heading (Arabic)'}
                  value={section.headingAr}
                  onChange={(e) => updateSection(index, 'headingAr', e.target.value)}
                />
                <Input
                  label={isAr ? 'عنوان فرعي (EN)' : 'Heading (English)'}
                  value={section.headingEn}
                  onChange={(e) => updateSection(index, 'headingEn', e.target.value)}
                />
                <Textarea
                  label={isAr ? 'النص (عربي)' : 'Body (Arabic)'}
                  rows={compact ? 3 : 4}
                  value={section.bodyAr}
                  onChange={(e) => updateSection(index, 'bodyAr', e.target.value)}
                />
                <Textarea
                  label={isAr ? 'النص (EN)' : 'Body (English)'}
                  rows={compact ? 3 : 4}
                  value={section.bodyEn}
                  onChange={(e) => updateSection(index, 'bodyEn', e.target.value)}
                />
              </div>
            </div>
          ))}

          {!form.sections.length && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
              {isAr ? 'أضف قسمًا لعرض محتوى للعميل' : 'Add a section to show content to customers'}
            </p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => updateField('isActive', e.target.checked)}
        />
        {isAr ? 'الصفحة نشطة (ظاهرة للزوار)' : 'Page active (visible to visitors)'}
      </label>
    </div>
  );
}
