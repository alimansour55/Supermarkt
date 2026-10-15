import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Languages, Loader2, Monitor, Save, Smartphone,
} from 'lucide-react';
import { useBlocker } from '../../../app/router';
import Button from '../../../components/ui/Button';
import { useConfirm, useToast } from '../index';
import HomepageSectionForm, { payloadFromForm } from '../HomepageSectionForm';
import HomepageSectionOptions from './HomepageSectionOptions';
import HomepagePreviewFrame from './HomepagePreviewFrame';
import { homepageAdminApi } from '../../homepageAdminApi';
import { getSectionTypeMeta } from '../../utils/homepageSectionMeta';
import {
  copyLanguage,
  ruleChips,
  stableStringify,
  validateVisibilityForm,
  visibilityForPreview,
} from '../../utils/homepageBuilderRules';
import { RuleChip } from './HomepageRuleChip';
import useAdminHeaderHeight from '../../hooks/useAdminHeaderHeight';

const PREVIEW_DELAY_MS = 600;

/** What counts as "changed" — UI-only form fields are left out. */
const comparable = (form) => {
  const {
    productDetails: _details, linkedPromotion: _promotion, categoryIssue: _issue, ...rest
  } = form;
  return stableStringify(rest);
};

/**
 * Full-page section editor: the form on one side and a live storefront preview
 * of the unsaved section on the other. Guards against leaving with unsaved changes.
 */
export default function HomepageSectionEditor({
  initialForm,
  editId = null,
  categories = [],
  zones = [],
  isAr,
  onSave,
  onClose,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const formId = useId();
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(() => comparable(initialForm));
  const [saving, setSaving] = useState(false);
  // Phone first: it renders at full size here, and most shoppers are on phones.
  const [device, setDevice] = useState('mobile');
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState('loading');
  const savedRef = useRef(false);
  const headerHeight = useAdminHeaderHeight();

  const dirty = comparable(form) !== baseline;
  const typeMeta = getSectionTypeMeta(form.type);
  const visibilityErrors = useMemo(() => validateVisibilityForm(form.visibility, isAr), [form.visibility, isAr]);

  /* Live preview of the unsaved section (debounced; stale answers are dropped). */
  const payload = useMemo(() => payloadFromForm(form), [form]);
  const payloadKey = useMemo(() => stableStringify(payload), [payload]);
  useEffect(() => {
    const controller = new AbortController();
    setPreviewState((s) => (s === 'ready' ? 'refreshing' : 'loading'));
    const timer = setTimeout(() => {
      homepageAdminApi.preview(payload, { signal: controller.signal })
        .then((res) => {
          setPreview(res.data?.data || null);
          setPreviewState('ready');
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setPreviewState(error.response?.status === 400 ? 'invalid' : 'error');
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // payloadKey stands in for payload — same content, stable identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  /* The preview follows the form's look/visibility immediately, without waiting for the server. */
  const previewSections = useMemo(() => {
    if (!preview) return [];
    return [{
      ...preview,
      _id: preview._id || 'draft',
      appearance: { ...(preview.appearance || {}), ...(form.appearance || {}) },
      visibility: visibilityForPreview(form.visibility),
    }];
  }, [preview, form.appearance, form.visibility]);

  const chips = useMemo(
    () => ruleChips({ ...form, visibility: visibilityForPreview(form.visibility) }, isAr, { zones }),
    [form, isAr, zones],
  );

  /* Leaving with unsaved changes: closing the tab … */
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /* … or going to another admin page. */
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname
  ));
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes',
      message: isAr ? 'لم تحفظ تعديلات هذا القسم. هل تريد المغادرة وفقدانها؟' : 'Your changes to this section aren’t saved. Leave and lose them?',
      confirmLabel: isAr ? 'مغادرة بدون حفظ' : 'Leave without saving',
      cancelLabel: isAr ? 'البقاء' : 'Stay',
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm, isAr]);

  const requestClose = useCallback(async () => {
    if (dirty) {
      const leave = await confirm({
        title: isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes',
        message: isAr ? 'هل تريد الرجوع وفقدان التعديلات؟' : 'Go back and lose your changes?',
        confirmLabel: isAr ? 'رجوع بدون حفظ' : 'Discard changes',
        cancelLabel: isAr ? 'متابعة التعديل' : 'Keep editing',
        variant: 'danger',
      });
      if (!leave) return;
    }
    onClose();
  }, [dirty, confirm, isAr, onClose]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    if (Object.keys(visibilityErrors).length) {
      toast.error(Object.values(visibilityErrors)[0]);
      return;
    }
    setSaving(true);
    try {
      await onSave(payloadFromForm(form));
      savedRef.current = true;
      setBaseline(comparable(form));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || (isAr ? 'تعذر الحفظ' : 'Could not save section'));
    } finally {
      setSaving(false);
    }
  };

  /* Ctrl/Cmd + S saves. */
  const submitRef = useRef(handleSubmit);
  useEffect(() => { submitRef.current = handleSubmit; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fillLanguage = (from) => {
    const { form: next, count } = copyLanguage(form, from);
    if (!count) {
      toast.info(isAr ? 'لا توجد حقول فارغة لملئها' : 'No empty fields to fill');
      return;
    }
    setForm(next);
    toast.success(isAr ? `تم ملء ${count} حقل — راجعها وترجمها` : `Filled ${count} field(s) — review and translate them`);
  };

  const title = form.adminLabel
    || (isAr ? form.titleAr || form.titleEn : form.titleEn || form.titleAr)
    || (isAr ? typeMeta.labelAr : typeMeta.labelEn);

  return (
    <div className="space-y-4 pb-10" style={{ '--admin-header': `${headerHeight}px` }}>
      <div
        className="sticky z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8"
        style={{ top: headerHeight }}
      >
        <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={saving}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {isAr ? 'الأقسام' : 'Sections'}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-text">
            <span aria-hidden>{form.icon || typeMeta.icon}</span> {title}
          </p>
          <p className="truncate text-xs text-text-muted">
            {editId ? (isAr ? 'تعديل' : 'Editing') : (isAr ? 'قسم جديد' : 'New section')}
            {' · '}
            {isAr ? typeMeta.labelAr : typeMeta.labelEn}
            {dirty && (
              <span className="ms-2 font-semibold text-amber-700">● {isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes'}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border p-0.5" role="group" aria-label={isAr ? 'نسخ النصوص بين اللغتين' : 'Copy text between languages'}>
          <Languages className="ms-1.5 h-4 w-4 text-text-muted" aria-hidden />
          <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text" onClick={() => fillLanguage('ar')} title={isAr ? 'املأ الحقول الإنجليزية الفارغة من العربية' : 'Fill empty English fields from Arabic'}>
            AR → EN
          </button>
          <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text" onClick={() => fillLanguage('en')} title={isAr ? 'املأ الحقول العربية الفارغة من الإنجليزية' : 'Fill empty Arabic fields from English'}>
            EN → AR
          </button>
        </div>
        <Button type="submit" form={formId} disabled={saving || (!dirty && Boolean(editId))}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {saving ? (isAr ? 'جار الحفظ…' : 'Saving…') : (editId ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إضافة القسم' : 'Add section'))}
        </Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,46%)]">
        <div className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
          <HomepageSectionForm
            formId={formId}
            chrome={false}
            form={form}
            setForm={setForm}
            categories={categories}
            saving={saving}
            editId={editId}
            onSubmit={handleSubmit}
            onCancel={requestClose}
            optionsSlot={(
              <div className="space-y-2 border-t border-border pt-5">
                <h3 className="text-sm font-bold text-text">{isAr ? 'العرض والجمهور' : 'Visibility & look'}</h3>
                <HomepageSectionOptions form={form} setForm={setForm} isAr={isAr} zones={zones} />
              </div>
            )}
          />
        </div>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-[calc(var(--admin-header)+5rem)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-text">{isAr ? 'معاينة مباشرة' : 'Live preview'}</p>
              {previewState === 'refreshing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" aria-label={isAr ? 'تحديث' : 'Updating'} />}
            </div>
            <DeviceToggle device={device} onChange={setDevice} isAr={isAr} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => <RuleChip key={chip.key} chip={chip} />)}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 xl:max-h-[calc(100vh-var(--admin-header)-11rem)] xl:overflow-y-auto">
            {previewState === 'invalid' || previewState === 'error' ? (
              <p className="py-12 text-center text-sm text-text-muted">
                {previewState === 'invalid'
                  ? (isAr ? 'أكمل الحقول المطلوبة لعرض المعاينة' : 'Fill in the required fields to see a preview')
                  : (isAr ? 'تعذّر تحميل المعاينة' : 'Could not load the preview')}
              </p>
            ) : (
              <HomepagePreviewFrame
                sections={previewSections}
                device={device}
                interactive={false}
                minHeight={160}
                title={isAr ? 'معاينة القسم' : 'Section preview'}
              />
            )}
          </div>
          {['daily_offers', 'flash_sale'].includes(form.type) && !editId && (
            <p className="text-xs text-text-muted">
              {isAr ? 'منتجات العرض تُختار عند الحفظ.' : 'Deal products are picked when you save.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function DeviceToggle({ device, onChange, isAr }) {
  const options = [
    { value: 'desktop', icon: Monitor, labelAr: 'كمبيوتر', labelEn: 'Desktop' },
    { value: 'mobile', icon: Smartphone, labelAr: 'موبايل', labelEn: 'Phone' },
  ];
  return (
    <div className="flex rounded-xl border border-border bg-surface-muted/40 p-0.5" role="group">
      {options.map(({ value, icon: Icon, labelAr, labelEn }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={device === value}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            device === value ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {isAr ? labelAr : labelEn}
        </button>
      ))}
    </div>
  );
}
