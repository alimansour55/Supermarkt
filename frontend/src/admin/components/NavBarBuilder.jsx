import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, GripVertical, Home, Link2, Plus, Smartphone, Tag, Trash2,
} from 'lucide-react';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  DEFAULT_HOME_NAV,
  isHomeHref,
  normalizeHref,
  parseNavigationConfig,
  reindexNavSortOrders,
} from '../../utils/navBarConfig';
import { buildCategoryPath, buildCategorySlugChain } from '../../utils/categoryHelpers';
import { normalizeNavHref } from '../utils/navigationHelpers';

const emptyLink = () => ({
  labelAr: '',
  labelEn: '',
  href: '/offers',
  sortOrder: 0,
  isExternal: false,
  highlight: false,
  isActive: true,
  showOnMobile: true,
});

function MobileVisibilityField({ checked, onChange, isAr }) {
  return (
    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
      <Smartphone className="h-4 w-4 text-text-muted" aria-hidden />
      <input type="checkbox" checked={checked !== false} onChange={(e) => onChange(e.target.checked)} />
      {isAr ? 'الموبايل' : 'Mobile'}
    </label>
  );
}

function categoryLabel(cat, isAr) {
  if (!cat) return '';
  return isAr ? (cat.nameAr || cat.name) : (cat.nameEn || cat.name);
}

function typeMeta(type, isAr) {
  if (type === 'home') {
    return {
      icon: Home,
      badge: isAr ? 'الرئيسية · كل الأقسام' : 'Home · all categories',
      tone: 'bg-primary-100 text-primary-800',
    };
  }
  if (type === 'category') {
    return {
      icon: Tag,
      badge: isAr ? 'قسم مخصص' : 'Custom category',
      tone: 'bg-amber-100 text-amber-900',
    };
  }
  return {
    icon: Link2,
    badge: isAr ? 'رابط مباشر' : 'Direct link',
    tone: 'bg-slate-100 text-slate-700',
  };
}

export default function NavBarBuilder({ isAr, navigation, onChange }) {
  const [allCategories, setAllCategories] = useState([]);
  const [pickSlug, setPickSlug] = useState('');

  const { homeNav, headerLinks, navCategories } = useMemo(
    () => parseNavigationConfig(navigation),
    [navigation],
  );

  useEffect(() => {
    adminApi.getCategories({ limit: 500, page: 1 })
      .then(({ data }) => setAllCategories(data.data || []))
      .catch(() => setAllCategories([]));
  }, []);

  const bySlug = useMemo(
    () => new Map(allCategories.map((cat) => [cat.slug, cat])),
    [allCategories],
  );

  const usedCategorySlugs = useMemo(
    () => new Set(navCategories.map((item) => item.categorySlug)),
    [navCategories],
  );

  const orderedRows = useMemo(() => {
    const rows = [
      { key: 'home', type: 'home', sortOrder: homeNav.sortOrder ?? 0, data: homeNav },
      ...headerLinks.map((link, index) => ({
        key: `link-${index}`,
        type: 'link',
        sortOrder: link.sortOrder ?? index + 1,
        data: link,
        index,
      })),
      ...navCategories.map((item, index) => ({
        key: `cat-${item.categorySlug}`,
        type: 'category',
        sortOrder: item.sortOrder ?? index + 20,
        data: item,
        index,
      })),
    ];
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [homeNav, headerLinks, navCategories]);

  const commit = (nextHome, nextLinks, nextCategories) => {
    const reindexed = reindexNavSortOrders(nextHome, nextLinks, nextCategories);
    onChange({
      ...navigation,
      homeNav: reindexed.homeNav,
      headerLinks: reindexed.headerLinks,
      navCategories: reindexed.navCategories,
      showCategoryLinks: false,
    });
  };

  const moveRow = (rowKey, dir) => {
    const order = [...orderedRows];
    const idx = order.findIndex((row) => row.key === rowKey);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];

    const nextHome = { ...homeNav };
    const nextLinks = headerLinks.map((link) => ({ ...link }));
    const nextCategories = navCategories.map((item) => ({ ...item }));

    order.forEach((row, sortOrder) => {
      if (row.type === 'home') nextHome.sortOrder = sortOrder;
      if (row.type === 'link') nextLinks[row.index].sortOrder = sortOrder;
      if (row.type === 'category') nextCategories[row.index].sortOrder = sortOrder;
    });

    commit(nextHome, nextLinks, nextCategories);
  };

  const addLink = () => {
    commit(homeNav, [...headerLinks, { ...emptyLink(), sortOrder: headerLinks.length + 1 }], navCategories);
  };

  const addCategory = () => {
    if (!pickSlug || usedCategorySlugs.has(pickSlug)) return;
    commit(homeNav, headerLinks, [
      ...navCategories,
      { categorySlug: pickSlug, labelAr: '', labelEn: '', sortOrder: navCategories.length + 20, isActive: true, showOnMobile: true },
    ]);
    setPickSlug('');
  };

  const updateHome = (field, value) => {
    commit({ ...homeNav, [field]: value }, headerLinks, navCategories);
  };

  const updateLink = (index, field, value) => {
    const next = headerLinks.map((link, i) => {
      if (i !== index) return link;
      if (field === 'href') return { ...link, href: normalizeNavHref(value) };
      return { ...link, [field]: value };
    });
    commit(homeNav, next, navCategories);
  };

  const removeLink = (index) => {
    commit(homeNav, headerLinks.filter((_, i) => i !== index), navCategories);
  };

  const updateCategory = (index, field, value) => {
    const next = navCategories.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    ));
    commit(homeNav, headerLinks, next);
  };

  const removeCategory = (index) => {
    commit(homeNav, headerLinks, navCategories.filter((_, i) => i !== index));
  };

  const availableCategories = allCategories.filter(
    (cat) => cat.isActive !== false && cat.slug && !usedCategorySlugs.has(cat.slug),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-bold">{isAr ? 'شريط التنقل (الصفحة الرئيسية)' : 'Storefront nav bar'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {isAr
            ? '«الرئيسية» تعرض كل الأقسام والمنتجات الفرعية. أضف روابط (مثل العروض) أو أقساماً مخصصة منفصلة — ورتّب كل العناصر بالأسهم. استخدم «الموبايل» لإظهار أو إخفاء كل عنصر في قائمة الموبايل.'
            : 'Home shows all categories and subcategories. Add direct links (e.g. Offers) or separate custom categories — reorder with arrows. Use Mobile to show or hide each item in the mobile menu.'}
        </p>
      </div>

      <div className="space-y-3">
        {orderedRows.map((row) => {
          const meta = typeMeta(row.type, isAr);
          const Icon = meta.icon;

          if (row.type === 'home') {
            return (
              <div key={row.key} className="rounded-xl border-2 border-primary-200 bg-primary-50/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-text-muted" aria-hidden />
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                      {meta.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded-lg p-1.5 hover:bg-white" onClick={() => moveRow(row.key, -1)} aria-label="Up">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 hover:bg-white" onClick={() => moveRow(row.key, 1)} aria-label="Down">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input label={isAr ? 'الاسم (عربي)' : 'Label AR'} value={homeNav.labelAr || ''} onChange={(e) => updateHome('labelAr', e.target.value)} placeholder={DEFAULT_HOME_NAV.labelAr} />
                  <Input label={isAr ? 'الاسم (EN)' : 'Label EN'} value={homeNav.labelEn || ''} onChange={(e) => updateHome('labelEn', e.target.value)} placeholder={DEFAULT_HOME_NAV.labelEn} />
                  <div className="flex flex-wrap items-end gap-4 pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={homeNav.isActive !== false} onChange={(e) => updateHome('isActive', e.target.checked)} />
                      {isAr ? 'نشط' : 'Active'}
                    </label>
                    <MobileVisibilityField
                      checked={homeNav.showOnMobile}
                      onChange={(value) => updateHome('showOnMobile', value)}
                      isAr={isAr}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-primary-800">
                  {isAr
                    ? 'عند التمرير على «الرئيسية» يرى العميل كل الأقسام — منفصلة عن الأقسام المخصصة التي تضيفها أدناه.'
                    : 'Hovering Home shows every category — separate from custom category items you add below.'}
                </p>
              </div>
            );
          }

          if (row.type === 'link') {
            const link = row.data;
            return (
              <div key={row.key} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-text-muted" />
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>{meta.badge}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded-lg p-1.5 hover:bg-surface" onClick={() => moveRow(row.key, -1)}><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" className="rounded-lg p-1.5 hover:bg-surface" onClick={() => moveRow(row.key, 1)}><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => removeLink(row.index)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input label={isAr ? 'عربي' : 'AR'} value={link.labelAr} onChange={(e) => updateLink(row.index, 'labelAr', e.target.value)} />
                  <Input label="EN" value={link.labelEn} onChange={(e) => updateLink(row.index, 'labelEn', e.target.value)} />
                  <Input label="URL" value={link.href} onChange={(e) => updateLink(row.index, 'href', e.target.value)} placeholder="/offers" />
                  <div className="flex flex-wrap items-end gap-3 pb-2">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={link.highlight} onChange={(e) => updateLink(row.index, 'highlight', e.target.checked)} />{isAr ? 'مميز' : 'Highlight'}</label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={link.isActive !== false} onChange={(e) => updateLink(row.index, 'isActive', e.target.checked)} />{isAr ? 'نشط' : 'Active'}</label>
                    <MobileVisibilityField
                      checked={link.showOnMobile}
                      onChange={(value) => updateLink(row.index, 'showOnMobile', value)}
                      isAr={isAr}
                    />
                  </div>
                </div>
              </div>
            );
          }

          const item = row.data;
          const cat = bySlug.get(item.categorySlug);
          const previewHref = cat ? buildCategoryPath(buildCategorySlugChain(cat, allCategories)) : '#';

          return (
            <div key={row.key} className="rounded-xl border border-amber-200 bg-amber-50/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-700" />
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>{meta.badge}</span>
                  <span className="text-sm font-semibold text-text">{categoryLabel(cat, isAr) || item.categorySlug}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-lg p-1.5 hover:bg-white" onClick={() => moveRow(row.key, -1)}><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" className="rounded-lg p-1.5 hover:bg-white" onClick={() => moveRow(row.key, 1)}><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => removeCategory(row.index)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input label={isAr ? 'تسمية عربية' : 'Arabic label'} value={item.labelAr} onChange={(e) => updateCategory(row.index, 'labelAr', e.target.value)} placeholder={categoryLabel(cat, true)} />
                <Input label={isAr ? 'تسمية EN' : 'English label'} value={item.labelEn} onChange={(e) => updateCategory(row.index, 'labelEn', e.target.value)} placeholder={categoryLabel(cat, false)} />
                <div className="flex flex-wrap items-end gap-3 pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.isActive !== false} onChange={(e) => updateCategory(row.index, 'isActive', e.target.checked)} />
                    {isAr ? 'نشط' : 'Active'}
                  </label>
                  <MobileVisibilityField
                    checked={item.showOnMobile}
                    onChange={(value) => updateCategory(row.index, 'showOnMobile', value)}
                    isAr={isAr}
                  />
                  {cat && (
                    <a href={previewHref} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary-600 hover:underline">
                      {isAr ? 'معاينة' : 'Preview'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" variant="secondary" onClick={addLink}>
          <Plus className="h-4 w-4" />
          {isAr ? 'إضافة رابط (مثل العروض)' : 'Add link (e.g. Offers)'}
        </Button>
        <div className="flex min-w-[200px] flex-1 items-end gap-2">
          <select
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            value={pickSlug}
            onChange={(e) => setPickSlug(e.target.value)}
          >
            <option value="">{isAr ? 'قسم مخصص...' : 'Custom category...'}</option>
            {availableCategories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>{categoryLabel(cat, isAr)}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={addCategory} disabled={!pickSlug}>
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة قسم' : 'Add category'}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function filterHeaderLinksForEditor(links = []) {
  return links.filter((link) => !isHomeHref(link.href));
}

export { emptyLink, isHomeHref, normalizeHref };
