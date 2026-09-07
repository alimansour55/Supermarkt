import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import ProductMultiPicker from './ProductMultiPicker';
import AdminCategoryLinkPicker from './AdminCategoryLinkPicker';
import SectionCategoryWarning from './SectionCategoryWarning';
import { resolveSectionCategoryHealth } from '../utils/sectionCategoryHealth';
import HomepageItemsEditor from './HomepageItemsEditor';
import HomepageAnnouncementEditor from './HomepageAnnouncementEditor';
import HomepageSplitPromoEditor from './HomepageSplitPromoEditor';
import HomepageHeroSlidesEditor from './HomepageHeroSlidesEditor';
import HomepageBrowseHubEditor from './HomepageBrowseHubEditor';
import HomepageCategoryNavEditor from './HomepageCategoryNavEditor';
import HomepageBrandRowEditor from './HomepageBrandRowEditor';
import HomepageProductShowcaseEditor, { DEFAULT_PRODUCT_SHOWCASE_CONFIG } from './HomepageProductShowcaseEditor';
import HomepageDealEditor, { DEFAULT_DEAL_CONFIG } from './HomepageDealEditor';
import HomepageLinkPresetSelect from './HomepageLinkPresetSelect';
import {
  HOMEPAGE_SECTION_CATEGORIES,
  PRODUCT_SORT_OPTIONS,
  CAMPAIGN_PLACEMENTS,
  LAYOUT_OPTIONS,
  ICON_PRESETS,
  getSectionTypeMeta,
  sectionFieldsFor,
  applySectionTypeDefaults,
  normalizeHomepageLink,
} from '../utils/homepageSectionMeta';
import { EMPTY_HERO_ROTATION, dateInputValue, normalizeHeroRotation } from '../utils/bannerScheduleUtils';
import { EMPTY_ANNOUNCEMENT_CONFIG, dateInputValue as announcementDateInput, normalizeAnnouncementConfig } from '../utils/announcementUtils';
import { DEFAULT_SPLIT_PROMO_CONFIG, normalizeSplitPromoConfig } from '../utils/splitPromoUtils';
import { DEFAULT_BROWSE_CONFIG, normalizeBrowseConfig } from '../utils/browseHubUtils';
import { DEFAULT_CATEGORY_NAV_CONFIG, normalizeCategoryNavConfig } from '../utils/categoryNavUtils';
import { DEFAULT_BRAND_ROW_CONFIG, normalizeBrandRowConfig } from '../utils/brandRowUtils';
import { normalizeProductShowcaseConfig, isProductShowcaseType } from '../utils/productShowcaseUtils';
import { normalizeDealConfig, isDealSectionType } from '../utils/dealShowcaseUtils';

function FormSection({ title, description, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-surface-muted/20 p-4 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function HomepageSectionForm({
  form,
  setForm,
  categories = [],
  saving = false,
  editId = null,
  onSubmit,
  onCancel,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateQuery = (field, value) => setForm((prev) => ({
    ...prev,
    productQuery: { ...prev.productQuery, [field]: value },
  }));
  const updateSeo = (field, value) => setForm((prev) => ({
    ...prev,
    seoContent: { ...prev.seoContent, [field]: value },
  }));

  const typeMeta = getSectionTypeMeta(form.type);
  const fields = sectionFieldsFor(form.type);
  const embedProductSource = isProductShowcaseType(form.type) || isDealSectionType(form.type);
  const layoutOptions = LAYOUT_OPTIONS[form.type] || [];
  const hideTitles = [
    'free_delivery_banner',
    'delivery_area_bar',
    'browse_hub',
    'top_categories',
    'categories_scroll',
    'brand_row',
    'subcategories_preview',
    'all_products_entry',
  ].includes(form.type);
  const showIconPicker = ![
    'hero_slider',
    'image_strip',
    'announcement_strip',
    'split_promo',
    'free_delivery_banner',
    'delivery_area_bar',
    'browse_hub',
    'top_categories',
    'categories_scroll',
    'brand_row',
    'subcategories_preview',
    'all_products_entry',
  ].includes(form.type);
  const browseHubTypes = ['browse_hub', 'top_categories', 'subcategories_preview', 'all_products_entry'];

  const handleTypeChange = (newType) => {
    if (newType === form.type) return;
    if (!editId) {
      setForm((prev) => applySectionTypeDefaults(prev, newType));
      return;
    }
    setForm((prev) => ({ ...prev, type: newType }));
  };

  const applyLinkPreset = (path) => {
    update('link', normalizeHomepageLink(path));
  };

  const needsCategory = form.type === 'category_spotlight' && !form.category;
  const categoryHealth = useMemo(
    () => resolveSectionCategoryHealth({
      categoryId: form.category,
      categoryIssue: form.categoryIssue,
      categories,
    }),
    [form.category, form.categoryIssue, categories],
  );
  const showCategoryLinkWarning = categoryHealth.status === 'missing' || categoryHealth.status === 'inactive';

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
      {form.category && showCategoryLinkWarning && (
        <SectionCategoryWarning
          categoryId={form.category}
          categoryIssue={form.categoryIssue}
          categories={categories}
          isAr={isAr}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/40 px-4 py-3">
        <p className="text-sm font-semibold text-primary-900">
          {editId ? (isAr ? 'تعديل القسم' : 'Editing section') : (isAr ? 'قسم جديد' : 'New section')}
          {' · '}
          {isAr ? typeMeta.labelAr : typeMeta.labelEn}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-primary-700 hover:underline"
        >
          {isAr ? '← العودة إلى Homepage CMS' : '← Back to Homepage CMS'}
        </button>
      </div>

      {form.type === 'split_promo' && (
        <FormSection
          title={isAr ? 'بطاقات ترويج مخصصة' : 'Custom promo cards'}
          description={
            isAr
              ? 'تصميم يدوي — مختلف عن «عروض وبانرات» التي تسحب من مكتبة البانرات.'
              : 'Hand-designed — separate from Promo & banners (banner library).'
          }
        >
          <HomepageSplitPromoEditor
            isAr={isAr}
            categories={categories}
            titleAr={form.titleAr}
            titleEn={form.titleEn}
            items={form.items || []}
            splitPromoConfig={form.splitPromoConfig}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onConfigChange={(config) => update('splitPromoConfig', config)}
            onItemsChange={(items) => update('items', items)}
          />
        </FormSection>
      )}

      {['announcement_strip', 'flash_strip'].includes(form.type) && (
        <FormSection
          title={isAr ? 'شريط الإعلان' : 'Announcement bar'}
          description={
            isAr
              ? 'رسالة قصيرة — توصيل مجاني، عروض سريعة، تنبيهات. يغني عن «شريط عرض سريع».'
              : 'Short message bar — free delivery, flash offers, alerts. Replaces flash sale strip.'
          }
        >
          {form.type === 'flash_strip' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {isAr
                ? '↪ «شريط عرض سريع» مدمج هنا — اختر النمط «بارز» أو قالب «عرض سريع».'
                : '↪ Flash sale strip is merged here — use Bold style or Flash sale preset.'}
            </div>
          )}
          <HomepageAnnouncementEditor
            isAr={isAr}
            categories={categories}
            titleAr={form.titleAr}
            titleEn={form.titleEn}
            subtitleAr={form.subtitleAr}
            subtitleEn={form.subtitleEn}
            ctaLabelAr={form.ctaLabelAr}
            ctaLabelEn={form.ctaLabelEn}
            link={form.link}
            icon={form.icon}
            layout={form.layout || 'accent'}
            items={form.items || []}
            announcementConfig={form.announcementConfig}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onConfigChange={(config) => update('announcementConfig', config)}
            onItemsChange={(items) => update('items', items)}
          />
        </FormSection>
      )}

      {browseHubTypes.includes(form.type) && (
        <FormSection
          title={isAr ? 'كتلة التصفّح' : 'Browse block'}
          description={
            isAr
              ? 'خيار واحد مرن — يغني عن «معاينة الأقسام» و«بطاقة كل المنتجات».'
              : 'One flexible block — replaces Subcategories preview & All products card.'
          }
        >
          {['subcategories_preview', 'all_products_entry', 'top_categories'].includes(form.type) && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {isAr
                ? '↪ هذا النوع مدمج في «كتلة التصفّح». يمكنك الإبقاء عليه أو إنشاء قسم جديد من النوع الموحّد.'
                : '↪ This type is merged into Browse block. Keep it or create a new unified section.'}
            </div>
          )}
          <HomepageBrowseHubEditor
            isAr={isAr}
            categories={categories}
            titleAr={form.titleAr}
            titleEn={form.titleEn}
            subtitleAr={form.subtitleAr}
            subtitleEn={form.subtitleEn}
            ctaLabelAr={form.ctaLabelAr}
            ctaLabelEn={form.ctaLabelEn}
            browseConfig={form.browseConfig}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onConfigChange={(config) => update('browseConfig', config)}
          />
        </FormSection>
      )}

      {form.type === 'categories_scroll' && (
        <FormSection
          title={isAr ? 'أقسام المتجر' : 'Store categories'}
          description={
            isAr
              ? 'الأقسام الرئيسية من بيانات المتجر — تمرير أو شبكة.'
              : 'Root departments from live store data — scroll or grid.'
          }
        >
          <HomepageCategoryNavEditor
            isAr={isAr}
            categories={categories}
            titleAr={form.titleAr}
            titleEn={form.titleEn}
            categoryNavConfig={form.categoryNavConfig}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onConfigChange={(config) => update('categoryNavConfig', config)}
          />
        </FormSection>
      )}

      {form.type === 'brand_row' && (
        <FormSection
          title={isAr ? 'صف العلامات' : 'Brand row'}
          description={
            isAr
              ? 'علامات يدوية أو افتراضية — تمرير أو شبكة.'
              : 'Manual or default brands — scroll or grid.'
          }
        >
          <HomepageBrandRowEditor
            isAr={isAr}
            categories={categories}
            titleAr={form.titleAr}
            titleEn={form.titleEn}
            link={form.link}
            icon={form.icon}
            items={form.items || []}
            brandRowConfig={form.brandRowConfig}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onConfigChange={(config) => update('brandRowConfig', config)}
            onItemsChange={(items) => update('items', items)}
          />
        </FormSection>
      )}

      {isProductShowcaseType(form.type) && (
        <FormSection
          title={isAr ? 'عرض المنتجات' : 'Product showcase'}
          description={
            isAr
              ? 'شريط أفقي أو شبكة — اختر قالباً جاهزاً أو خصّص الفلاتر أدناه.'
              : 'Scroll or grid — pick a quick preset or customize filters below.'
          }
        >
          {['product_carousel', 'top_rated'].includes(form.type) && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {isAr
                ? '↪ هذا النوع مدمج في «عرض المنتجات». يمكنك الإبقاء عليه أو حفظه بعد التعديل.'
                : '↪ This type is merged into Product showcase. Keep it or save after editing.'}
            </div>
          )}
          <HomepageProductShowcaseEditor
            isAr={isAr}
            form={form}
            categories={categories}
            onConfigChange={(config, layout) => setForm((prev) => ({
              ...prev,
              productShowcaseConfig: config,
              layout: layout || config.layout,
            }))}
            onApplyPreset={(next) => setForm(next)}
            onQueryChange={updateQuery}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
        </FormSection>
      )}

      {isDealSectionType(form.type) && (
        <FormSection
          title={isAr ? 'عروض مع عدّاد' : 'Deals & countdown'}
          description={
            isAr
              ? 'منتجات مخفّضة — نمط يومي، عرض سريع، أو بسيط.'
              : 'Discounted products — daily, flash, or minimal style.'
          }
        >
          {form.type === 'flash_sale' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {isAr
                ? '↪ «تخفيضات سريعة» مدمجة في «عروض مع عدّاد» — اختر نمط «عرض سريع».'
                : '↪ Flash sale merged into Deals & countdown — use Flash style.'}
            </div>
          )}
          <HomepageDealEditor
            isAr={isAr}
            form={form}
            categories={categories}
            onConfigChange={(config, layout) => setForm((prev) => ({
              ...prev,
              dealConfig: config,
              layout: layout || config.layout,
            }))}
            onFieldChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onQueryChange={updateQuery}
          />
        </FormSection>
      )}

      {form.type === 'hero_slider' && (
        <FormSection
          title={isAr ? 'شرائح السلايدر' : 'Hero slides'}
          description={
            isAr
              ? 'تحكم كامل بالصور والترتيب — لا يُعرض كل البانرات تلقائياً.'
              : 'Full control over images and order — not every banner is shown automatically.'
          }
        >
          <HomepageHeroSlidesEditor
            heroMode={form.heroMode || 'curated'}
            heroSlides={form.heroSlides || []}
            heroRotation={form.heroRotation || { startDate: '', cycleWeeks: 4, slots: [] }}
            heroAutoplaySeconds={form.heroAutoplaySeconds ?? 6}
            campaignPlacement={form.campaignPlacement || 'hero'}
            onModeChange={(mode) => update('heroMode', mode)}
            onSlidesChange={(slides) => update('heroSlides', slides)}
            onRotationChange={(rotation) => update('heroRotation', rotation)}
            onAutoplayChange={(seconds) => update('heroAutoplaySeconds', seconds)}
            onPlacementChange={(placement) => update('campaignPlacement', placement)}
            categories={categories}
          />
          <p className="mt-3 text-xs text-text-muted">
            {isAr
              ? '↕ ضع هذا القسم في أعلى القائمة (ترتيب 10–20) ليظهر أولاً في الصفحة الرئيسية.'
              : '↕ Drag this section to the top of the list (sort order 10–20) so it appears first on the homepage.'}
          </p>
        </FormSection>
      )}

      {['promo_grid', 'image_strip', 'sidebar_banners'].includes(form.type) && (
        <FormSection
          title={isAr ? 'عروض وبانرات' : 'Promo & banners'}
          description={
            isAr
              ? 'شبكة أو شريط أفقي — يدوي، جدولة، أو تلقائي. موضع Sidebar = البانرات الجانبية سابقاً.'
              : 'Grid or horizontal strip — manual, schedule, or auto. Sidebar placement = former sidebar banners.'
          }
        >
          {form.type !== 'promo_grid' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {isAr
                ? '↪ هذا النوع مدمج في «عروض وبانرات». يمكنك الإبقاء عليه أو إنشاء قسم جديد من النوع الموحّد.'
                : '↪ This type is merged into Promo & banners. Keep it or create a new unified section.'}
            </div>
          )}
          <HomepageHeroSlidesEditor
            variant={form.type === 'image_strip' ? 'strip' : 'promo'}
            heroMode={form.heroMode || (form.type === 'sidebar_banners' ? 'auto' : 'curated')}
            heroSlides={form.heroSlides || []}
            heroRotation={form.heroRotation || { startDate: '', cycleWeeks: 4, slots: [] }}
            gridColumns={form.gridColumns ?? (form.type === 'image_strip' ? 4 : 3)}
            layout={form.layout || (form.type === 'image_strip' ? 'scroll' : 'grid')}
            campaignPlacement={form.campaignPlacement || (form.type === 'sidebar_banners' ? 'sidebar' : 'promo')}
            onModeChange={(mode) => update('heroMode', mode)}
            onSlidesChange={(slides) => update('heroSlides', slides)}
            onRotationChange={(rotation) => update('heroRotation', rotation)}
            onGridColumnsChange={(cols) => update('gridColumns', cols)}
            onLayoutChange={(value) => update('layout', value)}
            onPlacementChange={(placement) => update('campaignPlacement', placement)}
            categories={categories}
          />
        </FormSection>
      )}

      <FormSection
        title={isAr ? 'أساسيات القسم' : 'Section basics'}
        description={isAr ? typeMeta.descriptionAr : typeMeta.descriptionEn}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'نوع القسم' : 'Section type'}</label>
            <select
              className="w-full rounded-xl border border-border px-4 py-2.5"
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {HOMEPAGE_SECTION_CATEGORIES.map((category) => (
                <optgroup key={category.id} label={isAr ? category.labelAr : category.labelEn}>
                  {category.types.filter((t) => !t.hidden).map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {isAr ? type.labelAr : type.labelEn}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <Input
            label={isAr ? 'الترتيب' : 'Sort order'}
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value)}
          />

          <div className="flex flex-col justify-end gap-3 rounded-xl border border-border bg-white px-4 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
              {isAr ? 'نشط على الموقع' : 'Active on site'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.showOnMobile !== false}
                onChange={(e) => update('showOnMobile', e.target.checked)}
              />
              {isAr ? 'يظهر في تطبيق/موبايل' : 'Show on mobile app'}
            </label>
          </div>

          {!hideTitles && !fields.announcement && !fields.splitPromo && !fields.browseHub && !fields.categoryNav && !fields.brandRow && (
            <>
              <Input
                label={isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}
                value={form.titleAr}
                onChange={(e) => update('titleAr', e.target.value)}
              />
              <Input
                label={isAr ? 'العنوان (EN)' : 'Title (English)'}
                value={form.titleEn}
                onChange={(e) => update('titleEn', e.target.value)}
              />
            </>
          )}

          {!hideTitles && form.type !== 'seo_text' && !fields.announcement && !fields.splitPromo && !fields.browseHub && !fields.categoryNav && !fields.brandRow && (
            <>
              <Input
                label={isAr ? 'الوصف (عربي)' : 'Subtitle (Arabic)'}
                value={form.subtitleAr}
                onChange={(e) => update('subtitleAr', e.target.value)}
              />
              <Input
                label={isAr ? 'الوصف (EN)' : 'Subtitle (English)'}
                value={form.subtitleEn}
                onChange={(e) => update('subtitleEn', e.target.value)}
              />
            </>
          )}

          {showIconPicker && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">{isAr ? 'الأيقونة' : 'Section icon'}</label>
              <div className="flex flex-wrap gap-2">
                {ICON_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => update('icon', emoji)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ${
                      form.icon === emoji
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-border bg-white hover:bg-surface-muted'
                    }`}
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={form.icon}
                onChange={(e) => update('icon', e.target.value)}
                placeholder={isAr ? 'أو اكتب أيقونة مخصصة' : 'Or type custom emoji'}
              />
            </div>
          )}
        </div>
      </FormSection>

      {(fields.link || fields.category || fields.campaign || fields.layout) && !fields.announcement && (
        <FormSection
          title={isAr ? 'الربط والعرض' : 'Link & display'}
          description={
            isAr
              ? 'حدّد رابط «عرض الكل» والقسم أو الحملة المرتبطة.'
              : 'Set the “View all” link, linked category, or banner campaign.'
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            {fields.campaign && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isAr ? 'موضع البانرات' : 'Banner placement'}</label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-2.5"
                  value={form.campaignPlacement}
                  onChange={(e) => update('campaignPlacement', e.target.value)}
                >
                  <option value="">{isAr ? 'افتراضي حسب النوع' : 'Default for type'}</option>
                  {CAMPAIGN_PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>{isAr ? p.labelAr : p.labelEn}</option>
                  ))}
                </select>
              </div>
            )}

            {fields.link && (
              <>
                <HomepageLinkPresetSelect
                  href={form.link}
                  isAr={isAr}
                  onChange={applyLinkPreset}
                />
                <Input
                  label={isAr ? 'الرابط' : 'Link URL'}
                  value={form.link}
                  onChange={(e) => update('link', e.target.value)}
                  placeholder="/products?section=best-sellers&sort=best-selling"
                  dir="ltr"
                />
              </>
            )}

            {fields.layout && layoutOptions.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isAr ? 'نمط العرض' : 'Layout style'}</label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-2.5"
                  value={form.layout || layoutOptions[0].value}
                  onChange={(e) => update('layout', e.target.value)}
                >
                  {layoutOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>
                  ))}
                </select>
              </div>
            )}

            {fields.category && (
              <div className={needsCategory ? 'rounded-xl ring-1 ring-amber-300' : ''}>
                <AdminCategoryLinkPicker
                  categories={categories}
                  value={form.category}
                  onChange={(categoryId) => setForm((prev) => ({
                    ...prev,
                    category: categoryId,
                    categoryIssue: null,
                  }))}
                  isAr={isAr}
                  required={form.type === 'category_spotlight'}
                  labelAr={form.type === 'category_spotlight' ? 'القسم (مطلوب)' : 'تصفية حسب القسم'}
                  labelEn={form.type === 'category_spotlight' ? 'Category (required)' : 'Filter by category'}
                  productQuery={form.productQuery}
                  sectionLimit={Number(form.productQuery?.limit) || 8}
                  categoryIssue={form.categoryIssue}
                />
              </div>
            )}
          </div>
        </FormSection>
      )}

      {fields.cta && (
        <FormSection
          title={isAr ? 'زر الإجراء' : 'Call-to-action button'}
          description={isAr ? 'نص الزر الذي يظهر في البطاقة.' : 'Button label shown on the card.'}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'نص الزر (عربي)' : 'Button text (Arabic)'}
              value={form.ctaLabelAr}
              onChange={(e) => update('ctaLabelAr', e.target.value)}
            />
            <Input
              label={isAr ? 'نص الزر (EN)' : 'Button text (English)'}
              value={form.ctaLabelEn}
              onChange={(e) => update('ctaLabelEn', e.target.value)}
            />
          </div>
        </FormSection>
      )}

      {fields.products && !embedProductSource && (
        <FormSection
          title={isAr ? 'المنتجات' : 'Products'}
          description={
            isAr
              ? 'اختر منتجات يدوياً أو اترك القائمة فارغة لملء القسم تلقائياً حسب الفلاتر.'
              : 'Pick products manually or leave empty to auto-fill from filters below.'
          }
        >
          {form.type === 'trending_searches' && (
            <p className="mb-4 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs text-orange-900">
              {isAr
                ? 'كلمات البحث الشائعة تُدار من «الأكثر بحثاً» في الإعدادات. يمكنك إضافة منتجات مقترحة يدوياً أدناه.'
                : 'Trending keywords are managed under Settings → Trending searches. Add suggested products below if needed.'}
            </p>
          )}

          {!form.products?.length && (
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isAr ? 'ترتيب المنتجات' : 'Product sort'}</label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-2.5"
                  value={form.productQuery.sort || 'newest'}
                  onChange={(e) => updateQuery('sort', e.target.value)}
                >
                  {PRODUCT_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>
                  ))}
                </select>
              </div>
              <Input
                label={isAr ? 'عدد المنتجات' : 'Product limit'}
                type="number"
                min="1"
                max="24"
                value={form.productQuery.limit}
                onChange={(e) => updateQuery('limit', e.target.value)}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isAr ? 'فلتر القسم' : 'Section filter'}</label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-2.5"
                  value={form.productQuery.section || ''}
                  onChange={(e) => updateQuery('section', e.target.value)}
                >
                  <option value="">{isAr ? 'بدون' : 'None'}</option>
                  <option value="best-sellers">{isAr ? 'الأكثر مبيعاً' : 'Best sellers'}</option>
                  <option value="new-arrivals">{isAr ? 'وصل حديثاً' : 'New arrivals'}</option>
                  <option value="top">{isAr ? 'مميز / الأعلى تقييماً' : 'Featured / top rated'}</option>
                </select>
              </div>
              <Input
                label={isAr ? 'ماركة' : 'Brand slug'}
                value={form.productQuery.brand || ''}
                onChange={(e) => updateQuery('brand', e.target.value)}
                placeholder="dettol"
                dir="ltr"
              />
              <label className="flex items-center gap-2 pt-7 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={!!form.productQuery.offers}
                  onChange={(e) => updateQuery('offers', e.target.checked)}
                />
                {isAr ? 'منتجات العروض فقط' : 'Offers / on-sale only'}
              </label>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {isAr ? 'منتجات محددة (اختياري)' : 'Hand-picked products (optional)'}
            </label>
            <p className="mb-3 text-xs text-text-muted">
              {form.products?.length
                ? (isAr
                  ? 'المنتجات المحددة تتجاوز الفلاتر التلقائية.'
                  : 'Selected products override automatic filters.')
                : (isAr
                  ? 'اترك فارغاً للاعتماد على الفلاتر أعلاه.'
                  : 'Leave empty to use the filters above.')}
            </p>
            <ProductMultiPicker
              value={form.products}
              onChange={(products) => update('products', products)}
              seedProducts={form.productDetails}
              categories={categories}
              isAr={isAr}
              maxItems={Number(form.productQuery.limit) || 24}
            />
          </div>
        </FormSection>
      )}

      {fields.items && !fields.splitPromo && (
        <FormSection
          title={isAr ? 'العلامات / الصور' : 'Brands / images'}
          description={
            isAr
              ? 'عناصر قابلة للنقر — بديل عن تحرير JSON يدوياً.'
              : 'Clickable tiles — no manual JSON editing needed.'
          }
        >
          <HomepageItemsEditor
            items={form.items || []}
            onChange={(items) => update('items', items)}
          />
        </FormSection>
      )}

      {fields.seo && (
        <FormSection
          title={form.type === 'rich_text_block' ? (isAr ? 'محتوى النص' : 'Text content') : (isAr ? 'نص SEO' : 'SEO content')}
          description={
            form.type === 'rich_text_block'
              ? (isAr ? 'يظهر في منتصف الصفحة الرئيسية.' : 'Shown mid-page on the homepage.')
              : (isAr ? 'يظهر في أسفل الصفحة الرئيسية.' : 'Shown at the bottom of the homepage.')
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              label={isAr ? 'النص (عربي)' : 'Body (Arabic)'}
              value={form.seoContent.bodyAr}
              onChange={(e) => updateSeo('bodyAr', e.target.value)}
              rows={6}
            />
            <Textarea
              label={isAr ? 'النص (EN)' : 'Body (English)'}
              value={form.seoContent.bodyEn}
              onChange={(e) => updateSeo('bodyEn', e.target.value)}
              rows={6}
            />
          </div>
        </FormSection>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ القسم' : 'Save section')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>
    </form>
  );
}

export const emptyHomepageForm = {
  type: 'product_grid',
  titleAr: '',
  titleEn: '',
  subtitleAr: '',
  subtitleEn: '',
  sortOrder: 100,
  isActive: true,
  showOnMobile: true,
  layout: '',
  ctaLabelAr: '',
  ctaLabelEn: '',
  link: '',
  icon: '',
  category: '',
  categoryIssue: null,
  products: [],
  productDetails: [],
  promotionId: '',
  linkedPromotion: null,
  campaignPlacement: '',
  productQuery: {
    section: '',
    sort: 'newest',
    brand: '',
    offers: false,
    limit: 12,
  },
  items: [],
  heroMode: 'curated',
  heroSlides: [],
  heroRotation: { ...EMPTY_HERO_ROTATION, unit: 'week', cycleLength: 4, periods: [] },
  heroAutoplaySeconds: 6,
  gridColumns: 3,
  announcementConfig: { ...EMPTY_ANNOUNCEMENT_CONFIG },
  splitPromoConfig: { ...DEFAULT_SPLIT_PROMO_CONFIG },
  browseConfig: { ...DEFAULT_BROWSE_CONFIG },
  categoryNavConfig: { ...DEFAULT_CATEGORY_NAV_CONFIG },
  brandRowConfig: { ...DEFAULT_BRAND_ROW_CONFIG },
  productShowcaseConfig: { ...DEFAULT_PRODUCT_SHOWCASE_CONFIG },
  dealConfig: { ...DEFAULT_DEAL_CONFIG },
  seoContent: {
    bodyAr: '',
    bodyEn: '',
  },
};

export function formFromSection(section) {
  const populatedProducts = (section.products || []).filter((product) => product && typeof product === 'object');
  const productIds = populatedProducts.length
    ? populatedProducts.map((p) => p._id).filter(Boolean)
    : (section.products || []).filter(Boolean);

  let browseConfig = normalizeBrowseConfig({
    ...DEFAULT_BROWSE_CONFIG,
    ...(section.browseConfig || {}),
  });
  if (section.type === 'subcategories_preview') {
    browseConfig = normalizeBrowseConfig({
      ...browseConfig,
      variant: 'banner',
      showProducts: false,
      subcategoriesLink: section.link || browseConfig.subcategoriesLink,
    });
  }
  if (section.type === 'all_products_entry') {
    browseConfig = normalizeBrowseConfig({
      ...browseConfig,
      variant: 'products',
      showSubcategories: false,
      productsLink: section.link || browseConfig.productsLink,
    });
  }

  let categoryNavConfig = normalizeCategoryNavConfig({
    ...DEFAULT_CATEGORY_NAV_CONFIG,
    ...(section.categoryNavConfig || {}),
  });
  if (section.type === 'categories_scroll' && section.layout && !section.categoryNavConfig?.layout) {
    categoryNavConfig = normalizeCategoryNavConfig({ ...categoryNavConfig, layout: section.layout });
  }
  if (section.type === 'categories_scroll' && section.link && !section.categoryNavConfig?.viewAllLink) {
    categoryNavConfig = normalizeCategoryNavConfig({ ...categoryNavConfig, viewAllLink: section.link });
  }

  return {
    ...emptyHomepageForm,
    ...section,
    category: section.categoryId || section.category?._id || section.category || '',
    categoryIssue: section.categoryIssue || null,
    products: productIds,
    productDetails: populatedProducts,
    productQuery: { ...emptyHomepageForm.productQuery, ...(section.productQuery || {}) },
    items: Array.isArray(section.items) ? section.items : [],
    heroMode: section.heroMode || 'curated',
    heroSlides: Array.isArray(section.heroSlides) ? section.heroSlides : [],
    heroRotation: normalizeHeroRotation({
      ...EMPTY_HERO_ROTATION,
      ...(section.heroRotation || {}),
      startDate: dateInputValue(section.heroRotation?.startDate) || section.heroRotation?.startDate || '',
      endDate: dateInputValue(section.heroRotation?.endDate) || section.heroRotation?.endDate || '',
    }),
    heroAutoplaySeconds: section.heroAutoplaySeconds ?? 6,
    gridColumns: Math.min(4, Math.max(2, Number(section.gridColumns) || 3)),
    announcementConfig: normalizeAnnouncementConfig({
      ...EMPTY_ANNOUNCEMENT_CONFIG,
      ...(section.announcementConfig || {}),
      startDate: announcementDateInput(section.announcementConfig?.startDate) || section.announcementConfig?.startDate || '',
      endDate: announcementDateInput(section.announcementConfig?.endDate) || section.announcementConfig?.endDate || '',
    }),
    splitPromoConfig: normalizeSplitPromoConfig({
      ...DEFAULT_SPLIT_PROMO_CONFIG,
      ...(section.splitPromoConfig || {}),
    }),
    browseConfig,
    categoryNavConfig,
    brandRowConfig: normalizeBrandRowConfig({
      ...DEFAULT_BRAND_ROW_CONFIG,
      ...(section.brandRowConfig || {}),
    }),
    productShowcaseConfig: normalizeProductShowcaseConfig(
      section.productShowcaseConfig || {},
      section,
    ),
    dealConfig: normalizeDealConfig(section.dealConfig || {}, section),
    promotionId: section.promotionId || '',
    linkedPromotion: section.linkedPromotion || null,
    seoContent: { ...emptyHomepageForm.seoContent, ...(section.seoContent || {}) },
    showOnMobile: section.showOnMobile !== false,
    layout: section.layout || '',
    ctaLabelAr: section.ctaLabelAr || '',
    ctaLabelEn: section.ctaLabelEn || '',
  };
}

export function payloadFromForm(form) {
  return {
    type: form.type,
    titleAr: form.titleAr,
    titleEn: form.titleEn,
    subtitleAr: form.subtitleAr,
    subtitleEn: form.subtitleEn,
    sortOrder: Number(form.sortOrder) || 0,
    isActive: form.isActive,
    showOnMobile: form.showOnMobile !== false,
    layout: form.layout || '',
    ctaLabelAr: form.ctaLabelAr || '',
    ctaLabelEn: form.ctaLabelEn || '',
    link: normalizeHomepageLink(form.link),
    icon: form.icon,
    category: form.category || null,
    products: form.products,
    promotionId: form.promotionId || null,
    campaignPlacement: form.campaignPlacement,
    productQuery: {
      ...form.productQuery,
      limit: Number(form.productQuery.limit) || 12,
      offers: !!form.productQuery.offers,
    },
    items: Array.isArray(form.items) ? form.items : [],
    heroMode: ['auto', 'weekly_rotation', 'curated'].includes(form.heroMode) ? form.heroMode : 'curated',
    heroSlides: Array.isArray(form.heroSlides) ? form.heroSlides : [],
    heroRotation: normalizeHeroRotation({
      startDate: form.heroRotation?.startDate || null,
      endDate: form.heroRotation?.endDate || null,
      runsForever: form.heroRotation?.runsForever !== false,
      isEnabled: form.heroRotation?.isEnabled !== false,
      sameFallback: form.heroRotation?.sameFallback !== false,
      fallbackAfterSlides: Array.isArray(form.heroRotation?.fallbackAfterSlides) ? form.heroRotation.fallbackAfterSlides : [],
      unit: form.heroRotation?.unit || 'week',
      cycleLength: Number(form.heroRotation?.cycleLength) || Number(form.heroRotation?.cycleWeeks) || 4,
      cycleWeeks: Number(form.heroRotation?.cycleWeeks) || Number(form.heroRotation?.cycleLength) || 4,
      periods: Array.isArray(form.heroRotation?.periods) ? form.heroRotation.periods : [],
      slots: Array.isArray(form.heroRotation?.slots) ? form.heroRotation.slots : [],
    }),
    heroAutoplaySeconds: Math.min(60, Math.max(0, Number(form.heroAutoplaySeconds) || 0)),
    gridColumns: Math.min(4, Math.max(2, Number(form.gridColumns) || 3)),
    announcementConfig: normalizeAnnouncementConfig({
      isEnabled: form.announcementConfig?.isEnabled !== false,
      startDate: form.announcementConfig?.startDate || null,
      endDate: form.announcementConfig?.endDate || null,
      runsForever: form.announcementConfig?.runsForever !== false,
      mode: form.announcementConfig?.mode === 'rotate' ? 'rotate' : 'single',
      rotateSeconds: Number(form.announcementConfig?.rotateSeconds) || 6,
      dismissible: !!form.announcementConfig?.dismissible,
      sticky: !!form.announcementConfig?.sticky,
    }),
    splitPromoConfig: normalizeSplitPromoConfig(form.splitPromoConfig || DEFAULT_SPLIT_PROMO_CONFIG),
    browseConfig: normalizeBrowseConfig(form.browseConfig || DEFAULT_BROWSE_CONFIG),
    categoryNavConfig: normalizeCategoryNavConfig(form.categoryNavConfig || DEFAULT_CATEGORY_NAV_CONFIG),
    brandRowConfig: normalizeBrandRowConfig(form.brandRowConfig || DEFAULT_BRAND_ROW_CONFIG),
    productShowcaseConfig: normalizeProductShowcaseConfig(form.productShowcaseConfig || {}, form),
    dealConfig: normalizeDealConfig(form.dealConfig || {}, form),
    seoContent: form.seoContent,
  };
}
