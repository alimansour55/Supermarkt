import { Plus, Trash2 } from 'lucide-react';
import { Field, SectionHeader, TagInput, inputCls } from './ui';

/** Common grocery specs — one tap adds the row with both labels filled in. */
const SPEC_PRESETS = [
  { keyAr: 'بلد المنشأ', keyEn: 'Country of origin' },
  { keyAr: 'الوزن الصافي', keyEn: 'Net weight' },
  { keyAr: 'المكونات', keyEn: 'Ingredients' },
  { keyAr: 'مدة الصلاحية', keyEn: 'Shelf life' },
  { keyAr: 'طريقة الحفظ', keyEn: 'Storage' },
  { keyAr: 'نوع العبوة', keyEn: 'Packaging' },
  { keyAr: 'مسببات الحساسية', keyEn: 'Allergens' },
  { keyAr: 'حلال', keyEn: 'Halal' },
];

export default function DetailsSection({ form, setForm, set, isAr }) {
  const specs = form.specs;
  const setSpecs = (next) => setForm((f) => ({ ...f, specs: next }));
  const setRow = (i, field, value) => setSpecs(specs.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  const used = new Set(specs.map((s) => s.keyEn));

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title={isAr ? 'المواصفات' : 'Specifications'}
          description={isAr ? 'تظهر كجدول في صفحة المنتج وتساعد العملاء على المقارنة.' : 'Shown as a table on the product page and help shoppers compare.'}
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SPEC_PRESETS.filter((p) => !used.has(p.keyEn)).map((p) => (
            <button
              key={p.keyEn}
              type="button"
              onClick={() => setSpecs([...specs, { ...p, valueAr: '', valueEn: '' }].slice(0, 40))}
              className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-300"
            >
              <Plus className="h-3 w-3" />{isAr ? p.keyAr : p.keyEn}
            </button>
          ))}
        </div>

        {specs.length > 0 && (
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[1fr_1.4fr_1fr_1.4fr_auto]">
                <input className={inputCls} placeholder={isAr ? 'الخاصية (عربي)' : 'Property (Arabic)'} value={s.keyAr} onChange={(e) => setRow(i, 'keyAr', e.target.value)} dir="rtl" />
                <input className={inputCls} placeholder={isAr ? 'القيمة (عربي)' : 'Value (Arabic)'} value={s.valueAr} onChange={(e) => setRow(i, 'valueAr', e.target.value)} dir="rtl" />
                <input className={inputCls} placeholder={isAr ? 'الخاصية (إنجليزي)' : 'Property (English)'} value={s.keyEn} onChange={(e) => setRow(i, 'keyEn', e.target.value)} dir="ltr" />
                <input className={inputCls} placeholder={isAr ? 'القيمة (إنجليزي)' : 'Value (English)'} value={s.valueEn} onChange={(e) => setRow(i, 'valueEn', e.target.value)} dir="ltr" />
                <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setSpecs([...specs, { keyAr: '', keyEn: '', valueAr: '', valueEn: '' }].slice(0, 40))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
          <Plus className="h-4 w-4" />{isAr ? 'مواصفة مخصصة' : 'Custom specification'}
        </button>
      </div>

      <div>
        <SectionHeader
          title={isAr ? 'كلمات البحث' : 'Search keywords'}
          description={isAr ? 'كلمات يكتبها العملاء ولا تظهر في الاسم: أسماء بديلة، أخطاء إملائية شائعة، استخدامات.' : "Words shoppers type that aren't in the name: other names, common misspellings, uses."}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isAr ? 'بالعربية' : 'Arabic'} hint={isAr ? 'اضغط Enter أو فاصلة بعد كل كلمة' : 'Press Enter or comma after each word'}>
            <TagInput value={form.searchKeywordsAr} onChange={set('searchKeywordsAr')} dir="rtl" placeholder={isAr ? 'مثال: عسل طبيعي، عسل نحل' : 'e.g. عسل طبيعي'} />
          </Field>
          <Field label={isAr ? 'بالإنجليزية' : 'English'} hint={isAr ? 'اضغط Enter أو فاصلة بعد كل كلمة' : 'Press Enter or comma after each word'}>
            <TagInput value={form.searchKeywordsEn} onChange={set('searchKeywordsEn')} dir="ltr" placeholder="e.g. natural honey, raw honey" />
          </Field>
        </div>
      </div>
    </div>
  );
}
