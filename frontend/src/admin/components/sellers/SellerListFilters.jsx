import { useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { ACCOUNT_HEALTH } from '../../../seller/sellerLabels';
import { SELLER_LIST_FLAGS, readSavedViews, upsertSavedView, writeSavedViews } from '../../utils/sellerAdmin';

const selectCls = 'rounded-xl border border-border bg-white px-2.5 py-2 text-sm';

/** Plan / health / "more" filters for the Sellers list, plus saved views (stored in this browser). */
export default function SellerListFilters({ isAr, filters, plans = [], onChange }) {
  const [views, setViews] = useState(() => readSavedViews());
  const active = ['plan', 'health', 'flag'].some((k) => filters[k]);

  const save = () => {
    const name = window.prompt(isAr ? 'اسم هذا العرض' : 'Name this view');
    if (!name) return;
    const next = upsertSavedView(views, name, { status: filters.status, plan: filters.plan, health: filters.health, flag: filters.flag });
    setViews(next);
    writeSavedViews(next);
  };
  const remove = (name) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    writeSavedViews(next);
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <select className={selectCls} value={filters.plan || ''} onChange={(e) => onChange({ plan: e.target.value })} aria-label={isAr ? 'الباقة' : 'Plan'}>
        <option value="">{isAr ? 'كل الباقات' : 'All plans'}</option>
        <option value="__none__">{isAr ? 'بدون باقة' : 'No plan'}</option>
        {plans.map((p) => <option key={p.key} value={p.key}>{isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr}</option>)}
      </select>
      <select className={selectCls} value={filters.health || ''} onChange={(e) => onChange({ health: e.target.value })} aria-label={isAr ? 'صحة الحساب' : 'Health'}>
        <option value="">{isAr ? 'أي صحة حساب' : 'Any health'}</option>
        {Object.entries(ACCOUNT_HEALTH).map(([k, h]) => <option key={k} value={k}>{isAr ? h.ar : h.en}</option>)}
      </select>
      <select className={selectCls} value={filters.flag || ''} onChange={(e) => onChange({ flag: e.target.value })} aria-label={isAr ? 'المزيد' : 'More'}>
        <option value="">{isAr ? 'المزيد…' : 'More…'}</option>
        {Object.entries(SELLER_LIST_FLAGS).map(([k, f]) => <option key={k} value={k}>{isAr ? f.ar : f.en}</option>)}
      </select>
      {active && (
        <>
          <button type="button" onClick={() => onChange({ plan: '', health: '', flag: '' })} className="text-xs font-semibold text-text-muted hover:text-text">{isAr ? 'مسح' : 'Clear'}</button>
          <button type="button" onClick={save} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700"><Bookmark className="h-3.5 w-3.5" />{isAr ? 'حفظ كعرض' : 'Save view'}</button>
        </>
      )}
      {views.length > 0 && (
        <div className="flex w-full flex-wrap gap-1.5">
          {views.map((v) => (
            <span key={v.name} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pe-1 ps-2.5 text-xs">
              <button type="button" onClick={() => onChange({ status: '', plan: '', health: '', flag: '', ...v.filters })} className="font-semibold">{v.name}</button>
              <button type="button" onClick={() => remove(v.name)} aria-label={isAr ? 'حذف' : 'Remove'} className="rounded-full p-0.5 text-text-muted hover:bg-slate-200"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
