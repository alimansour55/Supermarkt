import { MousePointerClick, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import {
  HEADER_BUILTIN_KEYS,
  HEADER_BUILTIN_META,
  emptyCustomToolbarItem,
  normalizeToolbarItem,
} from '../../../utils/headerToolbarConfig';
import { DEFAULT_HOME_NAV } from '../../../utils/navBarConfig';
import { normalizeNavHref } from '../../utils/navigationHelpers';
import HeaderToolbarIconPicker from '../HeaderToolbarIconPicker';
import HeaderToolbarStylePicker from '../HeaderToolbarStylePicker';
import LinkPresetSelect from '../LinkPresetSelect';
import CategoryBrowsePicker from '../CategoryBrowsePicker';

function PanelShell({ isAr, title, subtitle, onClose, children, footer }) {
  return (
    <div className="flex h-full max-h-[85vh] flex-col xl:max-h-[calc(100vh-12rem)]">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-orange-50/80 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800/70">
            {isAr ? 'تعديل' : 'Edit'}
          </p>
          <h3 className="truncate text-lg font-bold text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-sm text-text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-border bg-white p-2 text-text-muted hover:bg-slate-50"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-border bg-white px-5 py-4">{footer}</div>}
    </div>
  );
}

function EmptyPanel({ isAr }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center xl:min-h-[calc(100vh-12rem)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
        <MousePointerClick className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-base font-bold text-text">
        {isAr ? 'اختر عنصراً للتعديل' : 'Select an element to edit'}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-text-muted">
        {isAr
          ? 'انقر على شريط الإعلان أو رابط في الهيدر أو عنصر القائمة أو رابط في الفوتر من المعاينة.'
          : 'Click the announcement bar, a header link, menu item, or footer link in the preview.'}
      </p>
      <ul className="mt-5 space-y-2 text-start text-xs text-text-muted">
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold">↑↓</span>
          {isAr ? 'إعادة الترتيب' : 'Reorder items'}
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold">👁</span>
          {isAr ? 'إظهار / إخفاء' : 'Show / hide'}
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold">✏️</span>
          {isAr ? 'فتح لوحة التعديل' : 'Open edit panel'}
        </li>
      </ul>
    </div>
  );
}

function MobileToggle({ checked, onChange, isAr }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked !== false} onChange={(e) => onChange(e.target.checked)} />
      {isAr ? 'يظهر على الموبايل' : 'Show on mobile'}
    </label>
  );
}

export default function NavigationEditPanel({
  selection,
  navigation,
  categories,
  isAr,
  onChange,
  onClose,
  onDelete,
  onApplyContentPage,
}) {
  if (!selection) return <EmptyPanel isAr={isAr} />;

  const { zone } = selection;

  if (zone === 'announcement') {
    return (
      <PanelShell
        isAr={isAr}
        title={isAr ? 'شريط الإعلان' : 'Announcement bar'}
        subtitle={isAr ? 'النص في أعلى الموقع — سطح المكتب والموبايل' : 'Top strip text on desktop and mobile'}
        onClose={onClose}
      >
        <div className="space-y-4">
          <Input
            label={isAr ? 'نص عربي' : 'Arabic text'}
            value={navigation.announcementAr || ''}
            onChange={(e) => onChange({ ...navigation, announcementAr: e.target.value })}
          />
          <Input
            label={isAr ? 'نص EN' : 'English text'}
            value={navigation.announcementEn || ''}
            onChange={(e) => onChange({ ...navigation, announcementEn: e.target.value })}
          />
        </div>
      </PanelShell>
    );
  }

  if (zone === 'toolbar') {
    const items = navigation.headerToolbar || [];
    const item = items[selection.index];
    if (!item) return null;
    const isBuiltin = HEADER_BUILTIN_KEYS.includes(item.itemKey);
    const meta = isBuiltin ? HEADER_BUILTIN_META[item.itemKey] : null;

    const updateItem = (patch) => {
      const next = items.map((row, i) => (i === selection.index ? { ...row, ...patch } : row));
      onChange({ ...navigation, headerToolbar: next });
    };

    return (
      <PanelShell
        isAr={isAr}
        title={isBuiltin ? (isAr ? meta.labelAr : meta.labelEn) : (isAr ? 'رابط الهيدر' : 'Header link')}
        subtitle={isBuiltin ? (isAr ? meta.descriptionAr : meta.descriptionEn) : (item.href || '/')}
        onClose={onClose}
        footer={!isBuiltin && onDelete ? (
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            {isAr ? 'حذف الرابط' : 'Delete link'}
          </Button>
        ) : null}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'الموضع' : 'Position'}</label>
            <select
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              value={item.zone || 'start'}
              onChange={(e) => updateItem({ zone: e.target.value })}
            >
              <option value="start">{isAr ? 'بجانب الشعار' : 'Near logo'}</option>
              <option value="end">{isAr ? 'نهاية الهيدر' : 'Header end'}</option>
            </select>
          </div>

          {!isBuiltin && (
            <>
              <Input label={isAr ? 'عربي' : 'Arabic'} value={item.labelAr || ''} onChange={(e) => updateItem({ labelAr: e.target.value })} />
              <Input label="EN" value={item.labelEn || ''} onChange={(e) => updateItem({ labelEn: e.target.value })} />
              <Input label="URL" value={item.href || ''} onChange={(e) => updateItem({ href: normalizeNavHref(e.target.value) })} />
              <LinkPresetSelect
                href={item.href}
                isAr={isAr}
                onApply={(preset) => {
                  updateItem({
                    labelAr: preset.labelAr || item.labelAr,
                    labelEn: preset.labelEn || item.labelEn,
                    href: normalizeNavHref(preset.path),
                    isExternal: preset.isExternal === true,
                  });
                  if (preset.slug && onApplyContentPage) onApplyContentPage(preset.slug);
                }}
              />
              <HeaderToolbarIconPicker
                value={item.icon}
                onChange={(icon) => updateItem({ icon })}
                isAr={isAr}
                sampleLabel={isAr ? item.labelAr : item.labelEn}
              />
              <HeaderToolbarStylePicker
                value={item.variant}
                onChange={(variant) => updateItem({ variant })}
                isAr={isAr}
                icon={item.icon}
                sampleLabel={isAr ? item.labelAr : item.labelEn}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.isExternal === true} onChange={(e) => updateItem({ isExternal: e.target.checked })} />
                {isAr ? 'رابط خارجي' : 'External link'}
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={item.isActive !== false} onChange={(e) => updateItem({ isActive: e.target.checked })} />
            {isAr ? 'نشط' : 'Active'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={item.showLabel !== false} onChange={(e) => updateItem({ showLabel: e.target.checked })} />
            {isAr ? 'إظهار النص' : 'Show label'}
          </label>
        </div>
      </PanelShell>
    );
  }

  if (zone === 'toolbar-add') {
    const usedKeys = new Set((navigation.headerToolbar || []).filter((i) => HEADER_BUILTIN_KEYS.includes(i.itemKey)).map((i) => i.itemKey));
    const addBuiltin = (key) => {
      const meta = HEADER_BUILTIN_META[key];
      const next = [
        ...(navigation.headerToolbar || []),
        normalizeToolbarItem({
          itemKey: key,
          zone: selection.toolbarZone || 'start',
          sortOrder: (navigation.headerToolbar || []).length,
          isActive: true,
          showLabel: true,
          labelAr: meta?.labelAr || '',
          labelEn: meta?.labelEn || '',
        }),
      ];
      onChange({ ...navigation, headerToolbar: next });
      onClose();
    };
    const addCustom = () => {
      const next = [...(navigation.headerToolbar || []), emptyCustomToolbarItem(selection.toolbarZone || 'start')];
      onChange({ ...navigation, headerToolbar: next });
      onClose();
    };

    return (
      <PanelShell
        isAr={isAr}
        title={isAr ? 'إضافة عنصر للهيدر' : 'Add header item'}
        onClose={onClose}
      >
        <div className="space-y-2">
          {HEADER_BUILTIN_KEYS.filter((k) => !usedKeys.has(k)).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addBuiltin(key)}
              className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-start text-sm font-semibold hover:bg-surface"
            >
              {isAr ? HEADER_BUILTIN_META[key].labelAr : HEADER_BUILTIN_META[key].labelEn}
            </button>
          ))}
          <button
            type="button"
            onClick={addCustom}
            className="flex w-full items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-start text-sm font-semibold text-primary-800 hover:bg-primary-100"
          >
            {isAr ? 'رابط مخصص (مثل كل المنتجات)' : 'Custom link (e.g. All Products)'}
          </button>
        </div>
      </PanelShell>
    );
  }

  if (zone === 'nav') {
    const { rowKey } = selection;
    const homeNav = navigation.homeNav || DEFAULT_HOME_NAV;
    const headerLinks = navigation.headerLinks || [];
    const navCategories = navigation.navCategories || [];

    const commitNav = (nextHome, nextLinks, nextCats) => {
      onChange({
        ...navigation,
        homeNav: nextHome,
        headerLinks: nextLinks,
        navCategories: nextCats,
        showCategoryLinks: false,
      });
    };

    if (rowKey === 'home') {
      return (
        <PanelShell
          isAr={isAr}
          title={isAr ? 'الرئيسية' : 'Home'}
          subtitle={isAr ? 'تعرض كل الأقسام عند التمرير' : 'Shows all categories on hover'}
          onClose={onClose}
        >
          <div className="space-y-4">
            <Input label={isAr ? 'الاسم (عربي)' : 'Label AR'} value={homeNav.labelAr || ''} onChange={(e) => commitNav({ ...homeNav, labelAr: e.target.value }, headerLinks, navCategories)} />
            <Input label={isAr ? 'الاسم (EN)' : 'Label EN'} value={homeNav.labelEn || ''} onChange={(e) => commitNav({ ...homeNav, labelEn: e.target.value }, headerLinks, navCategories)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={homeNav.isActive !== false} onChange={(e) => commitNav({ ...homeNav, isActive: e.target.checked }, headerLinks, navCategories)} />
              {isAr ? 'نشط' : 'Active'}
            </label>
            <MobileToggle checked={homeNav.showOnMobile} onChange={(v) => commitNav({ ...homeNav, showOnMobile: v }, headerLinks, navCategories)} isAr={isAr} />
          </div>
        </PanelShell>
      );
    }

    if (rowKey.startsWith('link-')) {
      const index = parseInt(rowKey.replace('link-', ''), 10);
      const link = headerLinks[index];
      if (!link) return null;
      const updateLink = (patch) => {
        const next = headerLinks.map((l, i) => (i === index ? { ...l, ...patch } : l));
        commitNav(homeNav, next, navCategories);
      };

      return (
        <PanelShell
          isAr={isAr}
          title={isAr ? 'رابط القائمة' : 'Menu link'}
          subtitle={link.href}
          onClose={onClose}
          footer={onDelete ? (
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>{isAr ? 'حذف' : 'Delete'}</Button>
          ) : null}
        >
          <div className="space-y-4">
            <Input label={isAr ? 'عربي' : 'Arabic'} value={link.labelAr || ''} onChange={(e) => updateLink({ labelAr: e.target.value })} />
            <Input label="EN" value={link.labelEn || ''} onChange={(e) => updateLink({ labelEn: e.target.value })} />
            <Input label="URL" value={link.href || ''} onChange={(e) => updateLink({ href: normalizeNavHref(e.target.value) })} />
            <LinkPresetSelect href={link.href} isAr={isAr} onApply={(preset) => {
              updateLink({
                labelAr: preset.labelAr,
                labelEn: preset.labelEn,
                href: normalizeNavHref(preset.path),
                isExternal: false,
              });
              if (preset.slug && onApplyContentPage) onApplyContentPage(preset.slug);
            }} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={link.highlight === true} onChange={(e) => updateLink({ highlight: e.target.checked })} />
              {isAr ? 'مميز (لون accent)' : 'Highlight (accent color)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={link.isActive !== false} onChange={(e) => updateLink({ isActive: e.target.checked })} />
              {isAr ? 'نشط' : 'Active'}
            </label>
            <MobileToggle checked={link.showOnMobile} onChange={(v) => updateLink({ showOnMobile: v })} isAr={isAr} />
          </div>
        </PanelShell>
      );
    }

    if (rowKey.startsWith('cat-')) {
      const slug = rowKey.replace('cat-', '');
      const index = navCategories.findIndex((c) => c.categorySlug === slug);
      const item = navCategories[index];
      if (!item) return null;
      const cat = categories.find((c) => c.slug === slug);
      const updateCat = (patch) => {
        const next = navCategories.map((c, i) => (i === index ? { ...c, ...patch } : c));
        commitNav(homeNav, headerLinks, next);
      };

      return (
        <PanelShell
          isAr={isAr}
          title={isAr ? 'قسم مخصص' : 'Custom category'}
          subtitle={cat ? (isAr ? cat.nameAr || cat.name : cat.nameEn || cat.name) : slug}
          onClose={onClose}
          footer={onDelete ? (
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>{isAr ? 'حذف' : 'Delete'}</Button>
          ) : null}
        >
          <div className="space-y-4">
            <Input label={isAr ? 'تسمية عربية' : 'Arabic label'} value={item.labelAr || ''} onChange={(e) => updateCat({ labelAr: e.target.value })} placeholder={cat?.nameAr || cat?.name} />
            <Input label={isAr ? 'تسمية EN' : 'English label'} value={item.labelEn || ''} onChange={(e) => updateCat({ labelEn: e.target.value })} placeholder={cat?.nameEn || cat?.name} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isActive !== false} onChange={(e) => updateCat({ isActive: e.target.checked })} />
              {isAr ? 'نشط' : 'Active'}
            </label>
            <MobileToggle checked={item.showOnMobile} onChange={(v) => updateCat({ showOnMobile: v })} isAr={isAr} />
          </div>
        </PanelShell>
      );
    }
  }

  if (zone === 'nav-add') {
    const addLink = () => {
      onChange({
        ...navigation,
        headerLinks: [
          ...(navigation.headerLinks || []),
          {
            labelAr: 'العروض',
            labelEn: 'Offers',
            href: '/offers',
            highlight: true,
            sortOrder: (navigation.headerLinks || []).length + 1,
            isActive: true,
            isExternal: false,
            showOnMobile: true,
          },
        ],
      });
      onClose();
    };

    const usedSlugs = new Set((navigation.navCategories || []).map((n) => n.categorySlug).filter(Boolean));
    const pickerCategories = categories.filter(
      (c) => c.isActive !== false && c.slug && !usedSlugs.has(c.slug),
    );

    const addCategory = (categoryId) => {
      const cat = categories.find((c) => String(c._id) === String(categoryId));
      if (!cat?.slug) return;
      onChange({
        ...navigation,
        navCategories: [
          ...(navigation.navCategories || []),
          {
            categorySlug: cat.slug,
            labelAr: '',
            labelEn: '',
            sortOrder: (navigation.navCategories || []).length + 20,
            isActive: true,
            showOnMobile: true,
          },
        ],
      });
      onClose();
    };

    return (
      <PanelShell isAr={isAr} title={isAr ? 'إضافة عنصر قائمة' : 'Add menu item'} onClose={onClose}>
        <div className="space-y-4">
          <button type="button" onClick={addLink} className="w-full rounded-xl border border-border px-4 py-3 text-start text-sm font-semibold hover:bg-surface">
            {isAr ? 'رابط مباشر (مثل العروض)' : 'Direct link (e.g. Offers)'}
          </button>
          {pickerCategories.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-text-muted">{isAr ? 'أو قسم من المتجر:' : 'Or store category:'}</p>
              <CategoryBrowsePicker
                categories={pickerCategories}
                value=""
                onChange={addCategory}
                isAr={isAr}
                showSelectionBanner={false}
              />
            </div>
          )}
        </div>
      </PanelShell>
    );
  }

  if (zone === 'footer-col') {
    const { colIndex } = selection;
    const column = navigation.footerColumns?.[colIndex];
    if (!column) return null;

    return (
      <PanelShell
        isAr={isAr}
        title={isAr ? 'عمود الفوتر' : 'Footer column'}
        onClose={onClose}
        footer={onDelete ? (
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>{isAr ? 'حذف العمود' : 'Delete column'}</Button>
        ) : null}
      >
        <div className="space-y-4">
          <Input label={isAr ? 'عنوان (عربي)' : 'Title (Arabic)'} value={column.titleAr || ''} onChange={(e) => {
            const cols = [...navigation.footerColumns];
            cols[colIndex] = { ...cols[colIndex], titleAr: e.target.value };
            onChange({ ...navigation, footerColumns: cols });
          }} />
          <Input label={isAr ? 'عنوان (EN)' : 'Title (English)'} value={column.titleEn || ''} onChange={(e) => {
            const cols = [...navigation.footerColumns];
            cols[colIndex] = { ...cols[colIndex], titleEn: e.target.value };
            onChange({ ...navigation, footerColumns: cols });
          }} />
        </div>
      </PanelShell>
    );
  }

  if (zone === 'footer-link') {
    const { colIndex, linkIndex } = selection;
    const column = navigation.footerColumns?.[colIndex];
    if (!column) return null;

    const link = column.links?.[linkIndex];
    if (!link) return null;

    const updateLink = (patch) => {
      const cols = [...navigation.footerColumns];
      const links = [...cols[colIndex].links];
      links[linkIndex] = { ...links[linkIndex], ...patch };
      cols[colIndex] = { ...cols[colIndex], links };
      onChange({ ...navigation, footerColumns: cols });
    };

    return (
      <PanelShell
        isAr={isAr}
        title={isAr ? 'رابط الفوتر' : 'Footer link'}
        subtitle={link.href}
        onClose={onClose}
        footer={onDelete ? (
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>{isAr ? 'حذف الرابط' : 'Delete link'}</Button>
        ) : null}
      >
        <div className="space-y-4">
          <LinkPresetSelect href={link.href} isAr={isAr} onApply={(preset) => {
            updateLink({
              labelAr: preset.labelAr,
              labelEn: preset.labelEn,
              href: normalizeNavHref(preset.path),
              isExternal: false,
            });
            if (preset.slug && onApplyContentPage) onApplyContentPage(preset.slug);
          }} />
          <Input label={isAr ? 'عربي' : 'Arabic'} value={link.labelAr || ''} onChange={(e) => updateLink({ labelAr: e.target.value })} />
          <Input label="EN" value={link.labelEn || ''} onChange={(e) => updateLink({ labelEn: e.target.value })} />
          <Input label="URL" value={link.href || ''} onChange={(e) => updateLink({ href: normalizeNavHref(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={link.isActive !== false} onChange={(e) => updateLink({ isActive: e.target.checked })} />
            {isAr ? 'نشط' : 'Active'}
          </label>
        </div>
      </PanelShell>
    );
  }

  return null;
}
