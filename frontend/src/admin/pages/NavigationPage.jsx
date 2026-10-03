import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ChevronDown, ChevronUp, FileText, HelpCircle, LayoutTemplate, Link2, Menu, RefreshCw, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import ContentPageEditorPanel from '../components/ContentPageEditorPanel';
import NavigationVisualBuilder from '../components/navigation/NavigationVisualBuilder';
import { useToast } from '../components';
import { serializeNavigationForSave } from '../../utils/navBarConfig';
import { parseHeaderToolbar, serializeHeaderToolbar } from '../../utils/headerToolbarConfig';
import {
  CONTENT_PAGE_PRESETS,
  hrefToContentSlug,
  normalizeNavHref,
  normalizePageForm,
} from '../utils/navigationHelpers';

const emptyLink = () => ({
  labelAr: '',
  labelEn: '',
  href: '/',
  sortOrder: 0,
  isExternal: false,
  highlight: false,
  isActive: true,
});

const emptyColumn = () => ({
  titleAr: '',
  titleEn: '',
  sortOrder: 0,
  links: [emptyLink()],
});

function normalizeNavigation(nav) {
  const serialized = serializeNavigationForSave(nav);
  const mapLinks = (links = []) => links.map((link, index) => ({
    ...link,
    href: normalizeNavHref(link.href),
    sortOrder: link.sortOrder ?? index,
  }));

  return {
    ...serialized,
    headerToolbar: serializeHeaderToolbar(parseHeaderToolbar(serialized)),
    footerColumns: (nav.footerColumns?.length ? nav.footerColumns : [emptyColumn()]).map((col, colIndex) => ({
      ...col,
      sortOrder: col.sortOrder ?? colIndex,
      links: mapLinks(col.links?.length ? col.links : [emptyLink()]),
    })),
  };
}

/** Top-level store fields the Header & Footer CMS also edits (brand, socials, contact, apps). */
const LINKED_SETTINGS_FIELDS = ['taglineAr', 'taglineEn', 'socialLinks', 'appLinks', 'supportPhone', 'supportEmail'];

function pickLinkedSettings(settings = {}) {
  const out = {};
  LINKED_SETTINGS_FIELDS.forEach((key) => {
    if (settings[key] !== undefined) out[key] = settings[key];
  });
  return out;
}

function navigationStats(nav) {
  const toolbar = parseHeaderToolbar(nav);
  const menuItems = 1 + (nav.headerLinks?.length || 0) + (nav.navCategories?.length || 0);
  const footerLinks = (nav.footerColumns || []).reduce((sum, col) => sum + (col.links?.length || 0), 0);
  return {
    toolbar: toolbar.filter((i) => i.isActive !== false).length,
    menuItems,
    footerColumns: nav.footerColumns?.length || 0,
    footerLinks,
  };
}

export default function NavigationPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [navigation, setNavigation] = useState({
    announcementAr: '',
    announcementEn: '',
    homeNav: { labelAr: 'الرئيسية', labelEn: 'Home', sortOrder: 0, isActive: true },
    headerLinks: [],
    navCategories: [],
    footerColumns: [],
  });
  const [storeSettings, setStoreSettings] = useState(null);
  const [contentPages, setContentPages] = useState({});
  const [expandedContentSlug, setExpandedContentSlug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [savingNav, setSavingNav] = useState(false);
  const [savingContentSlug, setSavingContentSlug] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState('');
  const [showHelp, setShowHelp] = useState(() => {
    try { return sessionStorage.getItem('nav-cms-help-dismissed') !== '1'; } catch { return true; }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [settingsRes, pagesRes] = await Promise.all([
        adminApi.getStoreSettings(),
        adminApi.getContentPages(),
      ]);
      const settings = settingsRes.data.data || {};
      const nav = settings.navigation || {};
      const normalized = normalizeNavigation(nav);
      setStoreSettings(settings);
      setNavigation(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setSavedSettingsSnapshot(JSON.stringify(pickLinkedSettings(settings)));

      const map = {};
      (pagesRes.data.data || []).forEach((page) => {
        map[page.slug] = normalizePageForm(page);
      });
      setContentPages(map);
    } catch (error) {
      const message = error.response?.data?.message
        || (isAr ? 'تعذر تحميل بيانات الهيدر والفوتر — تحقق من الاتصال وحاول مجدداً' : 'Could not load header & footer data — check your connection and try again');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (loading) return false;
    if (JSON.stringify(normalizeNavigation(navigation)) !== savedSnapshot) return true;
    return JSON.stringify(pickLinkedSettings(storeSettings || {})) !== savedSettingsSnapshot;
  }, [navigation, savedSnapshot, storeSettings, savedSettingsSnapshot, loading]);

  const stats = useMemo(() => navigationStats(navigation), [navigation]);

  const linkedContentSlugs = useMemo(() => {
    const slugs = new Set();
    navigation.footerColumns.forEach((col) => {
      (col.links || []).forEach((link) => {
        const slug = hrefToContentSlug(link.href);
        if (slug) slugs.add(slug);
      });
    });
    navigation.headerLinks.forEach((link) => {
      const slug = hrefToContentSlug(link.href);
      if (slug) slugs.add(slug);
    });
    return [...slugs];
  }, [navigation]);

  const saveNavigation = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSavingNav(true);
    try {
      const payload = normalizeNavigation(navigation);
      const linkedSettings = pickLinkedSettings(storeSettings || {});
      const form = new FormData();
      form.append('settings', JSON.stringify({ navigation: payload, ...linkedSettings }));
      await adminApi.updateStoreSettings(form);
      setNavigation(payload);
      setSavedSnapshot(JSON.stringify(payload));
      setSavedSettingsSnapshot(JSON.stringify(linkedSettings));
      toast.success(isAr ? 'تم حفظ الهيدر والفوتر' : 'Header & footer saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSavingNav(false);
    }
  };

  const dismissHelp = () => {
    setShowHelp(false);
    try { sessionStorage.setItem('nav-cms-help-dismissed', '1'); } catch { /* ignore */ }
  };

  const saveContentPage = async (slug) => {
    const form = contentPages[slug];
    if (!form) return;
    setSavingContentSlug(slug);
    try {
      const { data } = await adminApi.updateContentPage(slug, {
        ...form,
        sections: form.sections.map((s, i) => ({ ...s, sortOrder: i })),
      });
      setContentPages((prev) => ({ ...prev, [slug]: normalizePageForm(data.data) }));
      toast.success(isAr ? 'تم حفظ محتوى الصفحة' : 'Page content saved');
    } catch (error) {
      toast.error(error.response?.data?.message || (isAr ? 'تعذر حفظ المحتوى' : 'Content save failed'));
    } finally {
      setSavingContentSlug(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (loadError && !storeSettings) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50/60 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div>
          <p className="font-bold text-red-900">{isAr ? 'تعذر تحميل الصفحة' : 'Couldn’t load this page'}</p>
          <p className="mt-1 max-w-sm text-sm text-red-800/80">{loadError}</p>
        </div>
        <Button type="button" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      </div>
    );
  }

  const statCards = [
    { icon: LayoutTemplate, value: stats.toolbar, label: isAr ? 'عناصر الهيدر' : 'Header items' },
    { icon: Menu, value: stats.menuItems, label: isAr ? 'عناصر القائمة' : 'Menu items' },
    { icon: Link2, value: stats.footerLinks, label: isAr ? 'روابط الفوتر' : 'Footer links' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">
            {isAr ? 'الهيدر والفوتر' : 'Header & footer'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {isAr
              ? 'حرّر شريط الإعلان والهيدر والقائمة والفوتر بمعاينة حية — انقر أي عنصر لتعديله.'
              : 'Edit the announcement bar, header, menu, and footer with a live preview — click any element to edit it.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statCards.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 py-2 shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-text">{value}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showHelp && (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-sm">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-orange-950">
              {isAr ? 'نصيحة سريعة' : 'Quick tip'}
            </p>
            <p className="mt-0.5 text-orange-900/80">
              {isAr
                ? 'مرّر على عنصر في المعاينة ثم انقر ✏️ للتعديل. استخدم أزرار الترتيب والإخفاء من شريط الأدوات. بدّل بين سطح المكتب والموبايل قبل الحفظ.'
                : 'Hover an element in the preview, then click ✏️ to edit. Use reorder and hide controls in the toolbar. Switch desktop / mobile before saving.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissHelp}
            className="shrink-0 rounded-lg p-1.5 text-orange-700 hover:bg-orange-100"
            aria-label={isAr ? 'إغلاق' : 'Dismiss'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <NavigationVisualBuilder
        navigation={navigation}
        onChange={setNavigation}
        storeSettings={storeSettings}
        onChangeSettings={setStoreSettings}
        isAr={isAr}
        saving={savingNav}
        isDirty={isDirty}
        onSave={saveNavigation}
        onApplyContentPage={setExpandedContentSlug}
      />

      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-5 w-5 text-primary-600" />
              {isAr ? 'محتوى الصفحات الثابتة' : 'Static page content'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr
                ? 'النص الذي يظهر عند النقر على روابط مثل اتصل بنا والأسئلة الشائعة.'
                : 'Text shown when customers open Contact, FAQ, and other info pages.'}
            </p>
          </div>
          <Link to="/admin/content" className="text-sm font-semibold text-primary-600 hover:underline">
            {isAr ? 'إدارة المحتوى الكامل' : 'Full content manager'}
          </Link>
        </div>

        {linkedContentSlugs.length > 0 && (
          <div className="mx-5 mt-4 flex flex-wrap gap-1.5">
            <span className="text-xs font-medium text-text-muted">
              {isAr ? 'مربوطة في التنقل:' : 'Linked in navigation:'}
            </span>
            {linkedContentSlugs.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => setExpandedContentSlug(slug)}
                className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                {slug}
              </button>
            ))}
          </div>
        )}

        <div className="divide-y divide-border p-3 sm:p-5">
          {CONTENT_PAGE_PRESETS.map((preset) => {
            const form = contentPages[preset.slug];
            const isOpen = expandedContentSlug === preset.slug;
            const isLinked = linkedContentSlugs.includes(preset.slug);

            return (
              <div key={preset.slug} className={isLinked ? 'bg-emerald-50/30' : ''}>
                <button
                  type="button"
                  onClick={() => setExpandedContentSlug(isOpen ? null : preset.slug)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-start hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-text">
                      {isAr ? preset.labelAr : preset.labelEn}
                      {isLinked && (
                        <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {isAr ? 'مربوط' : 'Linked'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">{preset.path}</p>
                  </div>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-text-muted" /> : <ChevronDown className="h-5 w-5 text-text-muted" />}
                </button>

                {isOpen && form && (
                  <div className="border-t border-border px-3 py-4 sm:px-4">
                    <ContentPageEditorPanel
                      form={form}
                      onChange={(next) => setContentPages((prev) => ({ ...prev, [preset.slug]: next }))}
                      onSave={() => saveContentPage(preset.slug)}
                      saving={savingContentSlug === preset.slug}
                      isAr={isAr}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
