import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { ArrowDown, ArrowUp, Check, CornerDownRight, Eye, EyeOff, FolderPlus, Pencil, Tags, Trash2, X } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import { PageSkeleton } from '../ui';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function SectionForm({ isAr, roots, initial, onSubmit, onCancel, submitLabel }) {
  const [nameAr, setNameAr] = useState(initial?.nameAr || '');
  const [nameEn, setNameEn] = useState(initial?.nameEn || '');
  const [parent, setParent] = useState(initial?.parent ? String(initial.parent) : '');
  const [busy, setBusy] = useState(false);
  const canNest = !initial?.hasChildren;

  const submit = async (e) => {
    e.preventDefault();
    if (!nameAr.trim() && !nameEn.trim()) return;
    setBusy(true);
    const ok = await onSubmit({ nameAr, nameEn, parent: parent || null });
    setBusy(false);
    if (ok && !initial) { setNameAr(''); setNameEn(''); }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <input className={inputCls} value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={isAr ? 'الاسم بالعربية' : 'Arabic name'} dir="rtl" maxLength={80} />
      <input className={inputCls} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder={isAr ? 'الاسم بالإنجليزية' : 'English name'} dir="ltr" maxLength={80} />
      <select className={inputCls} value={parent} onChange={(e) => setParent(e.target.value)} disabled={!canNest} aria-label={isAr ? 'داخل قسم' : 'Inside section'}>
        <option value="">{isAr ? 'قسم رئيسي' : 'Top-level section'}</option>
        {roots.filter((r) => String(r._id) !== String(initial?._id)).map((r) => (
          <option key={r._id} value={r._id}>{isAr ? `داخل: ${r.nameAr}` : `Inside: ${r.nameEn}`}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || (!nameAr.trim() && !nameEn.trim())} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {initial ? <Check className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}{submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl p-2 ring-1 ring-slate-200 hover:bg-slate-50" aria-label={isAr ? 'إلغاء' : 'Cancel'}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}

/** The seller's own store sections — customers filter the seller's store page by them. */
export default function SellerCategoriesPage() {
  const { isAr, seller } = useOutletContext();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ uncategorized: 0, max: 200 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState('');

  const load = useCallback(() => sellerApi.listCategories()
    .then(({ data }) => { setItems(data.data || []); setMeta(data.meta || {}); })
    .catch(() => toast.error(isAr ? 'تعذّر تحميل الأقسام' : 'Could not load sections'))
    .finally(() => setLoading(false)), [isAr, toast]);

  useEffect(() => { load(); }, [load]);

  const roots = useMemo(() => items.filter((c) => !c.parent), [items]);
  const childrenOf = (id) => items.filter((c) => String(c.parent) === String(id));

  const run = async (fn, done) => {
    try {
      await fn();
      if (done) toast.success(done);
      await load();
      return true;
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
      return false;
    }
  };

  const create = (data) => run(() => sellerApi.createCategory(data), isAr ? 'تمت إضافة القسم' : 'Section added');
  const update = (id, data) => run(() => sellerApi.updateCategory(id, data)).then((ok) => { if (ok) setEditing(''); return ok; });
  const remove = (c) => {
    const msg = isAr
      ? `حذف «${c.nameAr}»؟ المنتجات لن تُحذف، فقط ستخرج من هذا القسم.`
      : `Delete "${c.nameEn}"? Products are kept — they're only taken out of this section.`;
    if (window.confirm(msg)) run(() => sellerApi.deleteCategory(c._id), isAr ? 'تم الحذف' : 'Deleted');
  };
  const move = (siblings, index, dir) => {
    const next = [...siblings];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => sellerApi.reorderCategories(next.map((c) => c._id)));
  };

  const storeUrl = seller?.slug ? `/${isAr ? 'ar' : 'en'}/sellers/${seller.slug}` : null;

  // Called as a function (not <Row/>) so an open edit form keeps its state across re-renders.
  const renderRow = (c, siblings, index, child = false) => (
    <li key={c._id} className={`rounded-xl ${child ? 'ms-6 bg-slate-50' : 'bg-white ring-1 ring-slate-200'} p-3`}>
      {editing === c._id ? (
        <SectionForm
          isAr={isAr}
          roots={roots}
          initial={{ ...c, hasChildren: childrenOf(c._id).length > 0 }}
          submitLabel={isAr ? 'حفظ' : 'Save'}
          onSubmit={(data) => update(c._id, data)}
          onCancel={() => setEditing('')}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {child && <CornerDownRight className="h-4 w-4 text-slate-400" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${c.isActive ? '' : 'text-slate-400 line-through'}`}>{isAr ? c.nameAr : c.nameEn}</p>
            <p className="text-xs text-slate-500">
              {isAr ? c.nameEn : c.nameAr}
              {' · '}
              <Link to={`/seller-center/products?sellerCategory=${c._id}`} className="font-semibold text-indigo-700 hover:underline">
                {isAr ? `${c.productCount} منتج` : `${c.productCount} product(s)`}
              </Link>
              {' · '}{isAr ? `${c.liveCount} معروض` : `${c.liveCount} live`}
              {!c.isActive && <span className="ms-1 text-amber-700">{isAr ? '· مخفي عن العملاء' : '· hidden from customers'}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={index === 0} onClick={() => move(siblings, index, -1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={isAr ? 'لأعلى' : 'Move up'}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" disabled={index === siblings.length - 1} onClick={() => move(siblings, index, 1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={isAr ? 'لأسفل' : 'Move down'}><ArrowDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => update(c._id, { isActive: !c.isActive })} className="rounded-lg p-1.5 hover:bg-slate-100" title={c.isActive ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}>
              {c.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setEditing(c._id)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label={isAr ? 'تعديل' : 'Edit'}><Pencil className="h-4 w-4" /></button>
            <button type="button" onClick={() => remove(c)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </li>
  );

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Tags className="h-6 w-6 text-indigo-600" aria-hidden />{isAr ? 'أقسام متجري' : 'My store sections'}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {isAr
            ? 'نظّم منتجاتك بأقسامك الخاصة (مثل: عسل، علب هدايا، عروض رمضان). تظهر هذه الأقسام كفلاتر في صفحة متجرك ليتصفح العملاء منتجاتك بسهولة. القسم الفارغ أو المخفي لا يظهر للعملاء.'
            : 'Organise your products with your own sections (e.g. Honey, Gift boxes, Ramadan offers). They show as filters on your store page so customers can browse your products. Empty or hidden sections are not shown to customers.'}
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noreferrer" className="ms-1 font-semibold text-indigo-700 hover:underline">{isAr ? 'عرض متجري' : 'View my store'}</a>
          )}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold">{isAr ? 'قسم جديد' : 'New section'}</h2>
        <SectionForm isAr={isAr} roots={roots} onSubmit={create} submitLabel={isAr ? 'إضافة' : 'Add'} />
        <p className="mt-2 text-xs text-slate-500">
          {isAr ? 'يكفي اسم واحد — يُستخدم للغتين إن تركت الآخر فارغاً. يمكن وضع قسم داخل قسم رئيسي (مستوى واحد).' : 'One name is enough — it is used for both languages if you leave the other empty. Sections can sit inside a top-level section (one level).'}
          {' '}{isAr ? `${items.length} / ${meta.max || 200}` : `${items.length} / ${meta.max || 200}`}
        </p>
      </section>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {isAr ? 'لا توجد أقسام بعد. أضف أول قسم لمتجرك بالأعلى.' : 'No sections yet. Add your first store section above.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {roots.map((c, i) => (
            <li key={c._id} className="space-y-2">
              <ul>{renderRow(c, roots, i)}</ul>
              {childrenOf(c._id).length > 0 && (
                <ul className="space-y-2">
                  {childrenOf(c._id).map((ch, j, arr) => renderRow(ch, arr, j, true))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {meta.uncategorized > 0 && (
        <Link to="/seller-center/products?sellerCategory=none" className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100">
          {isAr
            ? `${meta.uncategorized} منتج بدون قسم — اضغط لعرضها وإضافتها لأقسام دفعة واحدة.`
            : `${meta.uncategorized} product(s) have no section — click to view them and assign sections in bulk.`}
        </Link>
      )}
    </div>
  );
}
