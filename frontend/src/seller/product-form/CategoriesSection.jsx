import { useState } from 'react';
import { Link } from '../../app/router';
import { Check, Info, Plus, Settings2, Tags } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import MarketplaceCategoryPicker from '../MarketplaceCategoryPicker';
import { Field, SectionHeader, inputCls } from './ui';

const MAX_PER_PRODUCT = 10;

export default function CategoriesSection({
  form, set, isAr, sections, onSectionCreated, marketplaceCategories, live,
}) {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const selected = new Set(form.sellerCategories);

  const toggle = (id) => {
    const next = selected.has(id) ? form.sellerCategories.filter((x) => x !== id) : [...form.sellerCategories, id];
    set('sellerCategories')(next.slice(0, MAX_PER_PRODUCT));
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await sellerApi.createCategory(isAr ? { nameAr: name } : { nameEn: name });
      onSectionCreated(data.data);
      set('sellerCategories')([...form.sellerCategories, String(data.data._id)].slice(0, MAX_PER_PRODUCT));
      setNewName('');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر إنشاء القسم' : 'Could not create the section'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title={isAr ? 'أقسام متجري' : 'My store sections'}
          description={isAr
            ? 'أقسامك الخاصة — تظهر كفلاتر في صفحة متجرك. اختر قسماً أو أكثر، أو أنشئ قسماً جديداً هنا.'
            : 'Your own sections — customers use them to filter your store page. Pick one or more, or create a new one right here.'}
        >
          <Link to="/seller-center/categories" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
            <Settings2 className="h-3.5 w-3.5" />{isAr ? 'إدارة الأقسام' : 'Manage sections'}
          </Link>
        </SectionHeader>

        {sections.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sections.map((c) => {
              const id = String(c._id);
              const on = selected.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white ring-slate-200 hover:bg-slate-50'} ${c.parent ? 'ms-3' : ''} ${c.isActive ? '' : 'opacity-60'}`}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <Tags className="h-3.5 w-3.5 text-slate-400" />}
                  {c.parent && <span className="text-xs opacity-70">↳</span>}
                  {isAr ? c.nameAr : c.nameEn}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            {isAr ? 'ليس لديك أقسام بعد — أنشئ أول قسم بالأسفل.' : "You don't have sections yet — create your first one below."}
          </p>
        )}

        <div className="mt-3 flex max-w-md gap-2">
          <input
            className={inputCls}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            placeholder={isAr ? 'قسم جديد… مثال: علب هدايا' : 'New section… e.g. Gift boxes'}
            maxLength={80}
          />
          <button type="button" disabled={creating || !newName.trim()} onClick={create} className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50">
            <Plus className="h-4 w-4" />{isAr ? 'إنشاء' : 'Create'}
          </button>
        </div>
      </div>

      <div>
        <SectionHeader
          title={isAr ? 'قسم المنصة (اختياري)' : 'Marketplace category (optional)'}
          description={isAr
            ? 'أين يظهر منتجك في تصفح الموقع والبحث. إن لم تجد قسماً مناسباً اتركه فارغاً واقترح اسماً — سيضعه فريقنا في القسم الصحيح عند المراجعة.'
            : "Where your product appears when shoppers browse and search the whole site. Can't find a fit? Leave it empty and suggest one — our team places it during review."}
        />
        {live && (
          <p className="mb-3 flex gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
            <Info className="h-4 w-4 shrink-0" aria-hidden />
            {isAr ? 'منتج معروض: تغيير قسم المنصة يُراجع قبل ظهوره.' : 'Live product: a marketplace category change is reviewed before it shows.'}
          </p>
        )}
        <MarketplaceCategoryPicker categories={marketplaceCategories} value={form.category} onChange={set('category')} isAr={isAr} allowClear={!live} />
        {!form.category && (
          <Field
            className="mt-4"
            label={isAr ? 'اقترح قسماً جديداً' : 'Suggest a new category'}
            hint={isAr ? 'مثال: أدوات تربية النحل — يظهر لفريق المراجعة فقط.' : 'e.g. Beekeeping tools — only our review team sees this.'}
          >
            <input className={inputCls} value={form.categorySuggestion} onChange={set('categorySuggestion')} maxLength={120} />
          </Field>
        )}
      </div>
    </div>
  );
}
