import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, Palette, Plus, RefreshCw, RotateCcw, Save, Search, ShoppingBag, Trash2, Type,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { adminApi } from '../adminApi';
import {
  DEFAULT_SITE_FONT,
  filterFonts,
  FONT_GROUPS,
  getFont,
  resolveSiteFont,
  SITE_FONT_LIST,
} from '../../constants/siteFonts';
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SHADE,
  filterThemes,
  getTheme,
  getThemeColors,
  getThemeShadeLabel,
  resolveThemeColor,
  resolveThemeShade,
  SITE_THEME_LIST,
  THEME_GROUPS,
  THEME_SHADES,
} from '../../constants/siteThemes';
import {
  MAX_THEME_ROTATION_STEPS,
  MIN_THEME_ROTATION_STEPS,
  normalizeThemeRotation,
  themeRotationsEqual,
  themeStepKey,
  THEME_ROTATION_INTERVAL_OPTIONS,
} from '../../constants/themeRotation';
import { startThemeRotation, stopThemeRotation } from '../../utils/themeRotation';
import { applySiteFont, clearFontPreview, preloadSiteFonts } from '../../utils/applySiteFont';
import { applySiteTheme, clearThemePreview } from '../../utils/applySiteTheme';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';

function StorefrontPreview({ themeId, themeShade, fontId, storeName, isAr }) {
  const theme = getTheme(themeId);
  const colors = getThemeColors(themeId, themeShade);
  const font = getFont(fontId);
  const themeLabel = isAr ? theme.labelAr : theme.labelEn;
  const shadeLabel = getThemeShadeLabel(themeShade, isAr);
  const fontLabel = isAr ? font.labelAr : font.labelEn;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
      style={{ fontFamily: `'${font.family}', system-ui, sans-serif` }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: colors[700] }}>
        <p className="text-center text-xs text-white/90">
          {isAr ? 'معاينة مباشرة للواجهة' : 'Live storefront preview'}
          {' · '}
          <span className="font-semibold">{themeLabel}</span>
          {' · '}
          <span className="font-semibold">{shadeLabel}</span>
          {' · '}
          <span className="font-semibold">{fontLabel}</span>
        </p>
      </div>
      <div className="border-b px-4 py-2" style={{ backgroundColor: colors[50], borderColor: colors[100] }}>
        <p className="truncate text-center text-[11px] font-medium" style={{ color: colors[800] }}>
          {isAr ? 'توصيل سريع · مجاني فوق 500 ج.م' : 'Fast delivery · Free over 500 EGP'}
        </p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundColor: colors[600] }}
        >
          <ShoppingBag className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold" style={{ color: colors[700] }}>{storeName}</p>
          <p className="truncate text-[10px] text-text-muted">
            {isAr ? font.sampleAr : font.sampleEn}
          </p>
        </div>
        <span
          className="hidden rounded-xl px-4 py-2 text-sm font-bold text-white sm:inline-flex"
          style={{ backgroundColor: colors[600] }}
        >
          {isAr ? 'أضف للسلة' : 'Add to cart'}
        </span>
      </div>
      <div className="flex gap-2 border-t border-border/60 px-4 py-2">
        {[600, 500, 400, 300, 200, 100].map((shade) => (
          <span
            key={shade}
            className="h-2 flex-1 rounded-full"
            style={{ backgroundColor: colors[shade] }}
          />
        ))}
      </div>
    </div>
  );
}

function ThemePreviewCard({
  theme,
  selected,
  active,
  selectedShade,
  savedShade,
  onSelect,
  onSelectShade,
  isAr,
  storeName,
}) {
  const previewShade = selected ? selectedShade : DEFAULT_THEME_SHADE;
  const colors = getThemeColors(theme.id, previewShade);
  const label = isAr ? theme.labelAr : theme.labelEn;

  const handleShadeClick = (e, shade) => {
    e.stopPropagation();
    onSelectShade(theme.id, shade);
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-start transition-all ${
        selected ? 'shadow-md ring-2' : 'border-border hover:shadow-sm'
      }`}
      style={selected ? { borderColor: colors[600], boxShadow: `0 0 0 2px ${colors[200]}` } : undefined}
    >
      <button
        type="button"
        onClick={() => onSelect(theme.id)}
        className="flex flex-col text-start"
      >
        <div className="h-7" style={{ backgroundColor: colors[700] }} />
        <div className="space-y-2.5 p-3.5" style={{ backgroundColor: colors[50] }}>
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: colors[600] }}
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold" style={{ color: colors[700] }}>
                {storeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: colors[600] }}
            >
              {isAr ? 'زر' : 'Btn'}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: colors[600] }}>
              {isAr ? 'رابط' : 'Link'}
            </span>
          </div>
        </div>
      </button>

      <div className="border-t border-border/60 bg-white px-3 py-2.5">
        <p className="mb-1.5 text-[10px] font-medium text-text-muted">
          {isAr ? 'اختر درجة اللون (فاتح ← غامق)' : 'Pick shade (light ← dark)'}
        </p>
        <div className="flex gap-0.5">
          {THEME_SHADES.map((shade) => {
            const isShadeSelected = selected && selectedShade === shade;
            const isSavedShade = active && savedShade === shade;
            const lightSwatch = shade <= 300;
            return (
              <button
                key={shade}
                type="button"
                title={String(shade)}
                onClick={(e) => handleShadeClick(e, shade)}
                className={[
                  'relative h-5 flex-1 rounded-sm transition-transform hover:scale-y-125',
                  isShadeSelected ? 'ring-2 ring-offset-1' : '',
                  isSavedShade && !isShadeSelected ? 'ring-1 ring-offset-1 ring-text-muted/40' : '',
                ].join(' ')}
                style={{
                  backgroundColor: theme.colors[shade],
                  ...(isShadeSelected ? { ringColor: theme.colors[shade] } : {}),
                }}
                aria-label={isAr ? `درجة ${shade}` : `Shade ${shade}`}
                aria-pressed={isShadeSelected}
              >
                {isShadeSelected && (
                  <Check
                    className={`absolute inset-0 m-auto h-3 w-3 drop-shadow ${lightSwatch ? 'text-text' : 'text-white'}`}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 bg-white px-3.5 py-2.5">
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-text">{label}</span>
          {selected && (
            <span className="text-[10px] font-medium text-text-muted">
              {getThemeShadeLabel(selectedShade, isAr)}
            </span>
          )}
          {active && (
            <span className="text-[10px] font-medium text-text-muted">
              {isAr ? 'اللون الحالي' : 'Current'}
            </span>
          )}
        </div>
        {selected && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: colors[600] }}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

function ThemeRotationPanel({
  rotation,
  onChange,
  selectedTheme,
  selectedThemeShade,
  isAr,
}) {
  const canEnable = rotation.steps.length >= MIN_THEME_ROTATION_STEPS;

  const addCurrentStep = () => {
    if (rotation.steps.length >= MAX_THEME_ROTATION_STEPS) return;
    const next = {
      color: selectedTheme,
      shade: selectedThemeShade,
    };
    if (rotation.steps.some((step) => themeStepKey(step) === themeStepKey(next))) return;
    onChange({ ...rotation, steps: [...rotation.steps, next] });
  };

  const removeStep = (index) => {
    const steps = rotation.steps.filter((_, i) => i !== index);
    onChange({
      ...rotation,
      enabled: rotation.enabled && steps.length >= MIN_THEME_ROTATION_STEPS,
      steps,
    });
  };

  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rotation.steps.length) return;
    const steps = [...rotation.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    onChange({ ...rotation, steps });
  };

  const toggleEnabled = () => {
    if (!rotation.enabled && !canEnable) {
      onChange({
        ...rotation,
        enabled: true,
        steps: rotation.steps.length >= MIN_THEME_ROTATION_STEPS
          ? rotation.steps
          : [
            { color: selectedTheme, shade: selectedThemeShade },
            { color: selectedTheme, shade: selectedThemeShade === 600 ? 400 : 600 },
          ],
      });
      return;
    }
    onChange({ ...rotation, enabled: !rotation.enabled });
  };

  return (
    <div className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm">
            <RefreshCw className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-bold">{isAr ? 'تبديل الألوان تلقائياً' : 'Automatic color rotation'}</h3>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              {isAr
                ? 'ابنِ سلسلة من الألوان ودرجاتها — سيتنقل الموقع بينها تلقائياً ويكررها بنفس الترتيب.'
                : 'Build a series of colors and shades — the site will move through them automatically and repeat in the same order.'}
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm">
          <input
            type="checkbox"
            checked={rotation.enabled}
            onChange={toggleEnabled}
            className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-200"
          />
          {isAr ? 'تفعيل التبديل' : 'Enable rotation'}
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text">
              {isAr ? 'سلسلة الألوان' : 'Color series'}
              {' '}
              <span className="font-normal text-text-muted">
                ({rotation.steps.length}/{MAX_THEME_ROTATION_STEPS})
              </span>
            </p>
            <button
              type="button"
              onClick={addCurrentStep}
              disabled={rotation.steps.length >= MAX_THEME_ROTATION_STEPS}
              className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {isAr ? 'أضف اللون الحالي' : 'Add current color'}
            </button>
          </div>

          {rotation.steps.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-sm text-text-muted">
              {isAr
                ? 'اختر لوناً من الأسفل ثم اضغط «أضف اللون الحالي» — أضف لونين على الأقل.'
                : 'Pick a color below, then click Add current color — add at least 2 steps.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {rotation.steps.map((step, index) => {
                const theme = getTheme(step.color);
                const label = isAr ? theme.labelAr : theme.labelEn;
                const shadeLabel = getThemeShadeLabel(step.shade, isAr);
                const swatch = getThemeColors(step.color, step.shade)[600];
                return (
                  <li
                    key={`${themeStepKey(step)}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5"
                  >
                    <span className="w-6 text-xs font-bold text-text-muted">{index + 1}</span>
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg shadow-sm ring-1 ring-black/5"
                      style={{ backgroundColor: swatch }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{label}</p>
                      <p className="text-xs text-text-muted">{shadeLabel}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-30"
                        aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === rotation.steps.length - 1}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface disabled:opacity-30"
                        aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={isAr ? 'حذف' : 'Remove'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!canEnable && (
            <p className="mt-2 text-xs text-amber-700">
              {isAr
                ? `أضف ${MIN_THEME_ROTATION_STEPS} ألوان على الأقل لتفعيل التبديل التلقائي.`
                : `Add at least ${MIN_THEME_ROTATION_STEPS} colors to enable automatic rotation.`}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text">
            {isAr ? 'مدة كل لون' : 'Time per color'}
          </label>
          <select
            value={rotation.intervalMinutes}
            onChange={(e) => onChange({ ...rotation, intervalMinutes: Number(e.target.value) })}
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            {THEME_ROTATION_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {isAr ? option.labelAr : option.labelEn}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-text-muted">
            {isAr
              ? 'بعد انتهاء السلسلة يبدأ من اللون الأول تلقائياً.'
              : 'After the last color, the series repeats from the first.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FontPreviewCard({ font, selected, active, onSelect, isAr }) {
  const label = isAr ? font.labelAr : font.labelEn;
  const sample = isAr ? font.sampleAr : font.sampleEn;

  return (
    <button
      type="button"
      onClick={() => onSelect(font.id)}
      className={[
        'flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-start transition-all',
        selected ? 'border-primary-500 shadow-md ring-2 ring-primary-100' : 'border-border hover:shadow-sm',
      ].join(' ')}
      style={{ fontFamily: `'${font.family}', system-ui, sans-serif` }}
    >
      <div className="space-y-2 border-b border-border/60 px-4 py-4">
        <p className="text-lg font-bold leading-snug text-text">{sample}</p>
        <p className="text-sm text-text-muted">
          {isAr ? 'ABCDEFG 12345' : 'أبجد هوز ١٢٣٤٥'}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-text">{label}</span>
          <span className="text-[10px] text-text-muted">{font.family}</span>
          {active && (
            <span className="mt-0.5 block text-[10px] font-medium text-text-muted">
              {isAr ? 'الخط الحالي' : 'Current'}
            </span>
          )}
        </div>
        {selected && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
    </button>
  );
}

export default function AppearancePage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const { settings, refreshSettings } = useStoreSettings();
  const storeName = isAr
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);

  const initialTheme = resolveThemeColor(settings?.themeColor);
  const initialShade = resolveThemeShade(settings?.themeShade);
  const initialFont = resolveSiteFont(settings?.siteFont);
  const initialRotation = normalizeThemeRotation(settings?.themeRotation, {
    color: initialTheme,
    shade: initialShade,
  });

  const [savedTheme, setSavedTheme] = useState(initialTheme);
  const [savedThemeShade, setSavedThemeShade] = useState(initialShade);
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const [selectedThemeShade, setSelectedThemeShade] = useState(initialShade);
  const [savedRotation, setSavedRotation] = useState(initialRotation);
  const [selectedRotation, setSelectedRotation] = useState(initialRotation);
  const [savedFont, setSavedFont] = useState(initialFont);
  const [selectedFont, setSelectedFont] = useState(initialFont);
  const [loading, setLoading] = useState(!settings?.themeColor);
  const [saving, setSaving] = useState(false);
  const [colorQuery, setColorQuery] = useState('');
  const [colorGroup, setColorGroup] = useState('all');
  const [fontQuery, setFontQuery] = useState('');
  const [fontGroup, setFontGroup] = useState('all');

  const savedThemeRef = useRef(initialTheme);
  const savedThemeShadeRef = useRef(initialShade);
  const savedFontRef = useRef(initialFont);
  const userPickedRef = useRef(false);

  const filteredThemes = useMemo(
    () => filterThemes({ query: colorQuery, group: colorGroup }),
    [colorQuery, colorGroup],
  );

  const filteredFonts = useMemo(
    () => filterFonts({ query: fontQuery, group: fontGroup }),
    [fontQuery, fontGroup],
  );

  const hasUnsavedChanges = selectedTheme !== savedTheme
    || selectedThemeShade !== savedThemeShade
    || selectedFont !== savedFont
    || !themeRotationsEqual(selectedRotation, savedRotation);

  useEffect(() => {
    savedThemeRef.current = savedTheme;
  }, [savedTheme]);

  useEffect(() => {
    savedThemeShadeRef.current = savedThemeShade;
  }, [savedThemeShade]);

  useEffect(() => {
    savedFontRef.current = savedFont;
  }, [savedFont]);

  useEffect(() => {
    let mounted = true;
    adminApi.getStoreSettings()
      .then(({ data }) => {
        if (!mounted) return;
        const theme = resolveThemeColor(data.data?.themeColor);
        const shade = resolveThemeShade(data.data?.themeShade);
        const font = resolveSiteFont(data.data?.siteFont);
        const rotation = normalizeThemeRotation(data.data?.themeRotation, { color: theme, shade });
        setSavedTheme(theme);
        setSavedThemeShade(shade);
        setSavedRotation(rotation);
        setSavedFont(font);
        savedThemeRef.current = theme;
        savedThemeShadeRef.current = shade;
        savedFontRef.current = font;
        if (!userPickedRef.current) {
          setSelectedTheme(theme);
          setSelectedThemeShade(shade);
          setSelectedRotation(rotation);
          setSelectedFont(font);
          if (!rotation.enabled) {
            applySiteTheme(theme, { themeShade: shade });
          }
          applySiteFont(font);
        }
      })
      .catch(() => toast.error(isAr ? 'تعذر التحميل' : 'Load failed'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => () => {
    stopThemeRotation('appearance');
    clearThemePreview(savedThemeRef.current, savedThemeShadeRef.current);
    clearFontPreview(savedFontRef.current);
  }, []);

  useEffect(() => {
    const rotation = normalizeThemeRotation(selectedRotation, {
      color: selectedTheme,
      shade: selectedThemeShade,
    });
    if (rotation.enabled && rotation.steps.length >= MIN_THEME_ROTATION_STEPS) {
      startThemeRotation(rotation, 'appearance');
      return () => stopThemeRotation('appearance');
    }
    stopThemeRotation('appearance');
    return undefined;
  }, [selectedRotation, selectedTheme, selectedThemeShade]);

  useEffect(() => {
    preloadSiteFonts(filteredFonts.map((font) => font.id));
  }, [filteredFonts]);

  const handleSelectTheme = (themeId) => {
    const theme = resolveThemeColor(themeId);
    userPickedRef.current = true;
    setSelectedTheme(theme);
    if (!selectedRotation.enabled) {
      applySiteTheme(theme, { preview: true, themeShade: selectedThemeShade });
    }
  };

  const handleSelectThemeShade = (themeId, shade) => {
    const theme = resolveThemeColor(themeId);
    const resolvedShade = resolveThemeShade(shade);
    userPickedRef.current = true;
    setSelectedTheme(theme);
    setSelectedThemeShade(resolvedShade);
    if (!selectedRotation.enabled) {
      applySiteTheme(theme, { preview: true, themeShade: resolvedShade });
    }
  };

  const handleSelectFont = (fontId) => {
    const font = resolveSiteFont(fontId);
    userPickedRef.current = true;
    setSelectedFont(font);
    applySiteFont(font, { preview: true });
  };

  const handleDiscard = () => {
    userPickedRef.current = false;
    setSelectedTheme(savedTheme);
    setSelectedThemeShade(savedThemeShade);
    setSelectedRotation(savedRotation);
    setSelectedFont(savedFont);
    clearThemePreview(savedTheme, savedThemeShade);
    clearFontPreview(savedFont);
    stopThemeRotation('appearance');
    if (!savedRotation.enabled) {
      applySiteTheme(savedTheme, { themeShade: savedThemeShade });
    }
    applySiteFont(savedFont);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append('settings', JSON.stringify({
        themeColor: selectedTheme,
        themeShade: selectedThemeShade,
        themeRotation: selectedRotation,
        siteFont: selectedFont,
      }));
      await adminApi.updateStoreSettings(form);
      setSavedTheme(selectedTheme);
      setSavedThemeShade(selectedThemeShade);
      setSavedRotation(selectedRotation);
      setSavedFont(selectedFont);
      savedThemeRef.current = selectedTheme;
      savedThemeShadeRef.current = selectedThemeShade;
      savedFontRef.current = selectedFont;
      clearThemePreview(selectedTheme, selectedThemeShade);
      clearFontPreview(selectedFont);
      stopThemeRotation('appearance');
      if (!selectedRotation.enabled) {
        applySiteTheme(selectedTheme, { themeShade: selectedThemeShade });
      }
      applySiteFont(selectedFont);
      userPickedRef.current = false;
      refreshSettings();
      toast.success(isAr ? 'تم حفظ إعدادات المظهر' : 'Appearance settings saved');
    } catch (error) {
      clearThemePreview(savedTheme, savedThemeShade);
      clearFontPreview(savedFont);
      setSelectedTheme(savedTheme);
      setSelectedThemeShade(savedThemeShade);
      setSelectedRotation(savedRotation);
      setSelectedFont(savedFont);
      toast.error(error.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  const savedThemeLabel = isAr ? getTheme(savedTheme).labelAr : getTheme(savedTheme).labelEn;
  const savedThemeShadeLabel = getThemeShadeLabel(savedThemeShade, isAr);
  const selectedThemeLabel = isAr ? getTheme(selectedTheme).labelAr : getTheme(selectedTheme).labelEn;
  const selectedThemeShadeLabel = getThemeShadeLabel(selectedThemeShade, isAr);
  const savedFontLabel = isAr ? getFont(savedFont).labelAr : getFont(savedFont).labelEn;
  const selectedFontLabel = isAr ? getFont(selectedFont).labelAr : getFont(selectedFont).labelEn;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <PageHeader
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <Button type="button" variant="secondary" onClick={handleDiscard}>
                <RotateCcw className="h-4 w-4" />
                {isAr ? 'تراجع' : 'Discard'}
              </Button>
            )}
            <Button type="submit" disabled={saving || !hasUnsavedChanges}>
              <Save className="h-4 w-4" />
              {isAr ? 'حفظ المظهر' : 'Save appearance'}
            </Button>
          </div>
        )}
      />

      <StorefrontPreview
        themeId={selectedTheme}
        themeShade={selectedThemeShade}
        fontId={selectedFont}
        storeName={storeName}
        isAr={isAr}
      />

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Type className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">{isAr ? 'خط الموقع' : 'Site font'}</h2>
              <p className="text-sm text-text-muted">
                {isAr
                  ? 'اختر خطاً يدعم العربية والإنجليزية ويُطبَّق على كل صفحات المتجر ولوحة الإدارة.'
                  : 'Choose a font that supports Arabic and English across the storefront and admin.'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">
            <p className="text-text-muted">
              {isAr ? 'الخط المحفوظ:' : 'Saved:'}
              {' '}
              <span className="font-semibold text-text">{savedFontLabel}</span>
            </p>
            {selectedFont !== savedFont && (
              <p className="mt-0.5 text-amber-700">
                {isAr ? 'المعاينة:' : 'Preview:'}
                {' '}
                <span className="font-semibold">{selectedFontLabel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={fontQuery}
              onChange={(e) => setFontQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن خط...' : 'Search fonts...'}
              className="w-full rounded-xl border border-border bg-white py-2.5 ps-10 pe-3 text-sm outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSelectFont(DEFAULT_SITE_FONT)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {isAr ? 'العودة للقاهرة (الافتراضي)' : 'Reset to Cairo (default)'}
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {FONT_GROUPS.map((item) => {
            const active = fontGroup === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFontGroup(item.id)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-white text-text-muted hover:border-primary-200 hover:text-text',
                ].join(' ')}
              >
                {isAr ? item.labelAr : item.labelEn}
              </button>
            );
          })}
        </div>

        {filteredFonts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد خطوط مطابقة — جرّب بحثاً أو فئة أخرى.' : 'No matching fonts — try another search or category.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFonts.map((font) => (
              <FontPreviewCard
                key={font.id}
                font={font}
                selected={selectedFont === font.id}
                active={savedFont === font.id}
                onSelect={handleSelectFont}
                isAr={isAr}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          {isAr
            ? `${filteredFonts.length} من ${SITE_FONT_LIST.length} خط`
            : `${filteredFonts.length} of ${SITE_FONT_LIST.length} fonts`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Palette className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">{isAr ? 'ألوان الموقع' : 'Site colors'}</h2>
              <p className="text-sm text-text-muted">
                {isAr
                  ? 'اختر لوناً رئيسياً ودرجة سطوعه (من فاتح جداً إلى غامق جداً) للشريط العلوي والأزرار والروابط.'
                  : 'Pick a primary color and shade (very light to very dark) for the top bar, buttons, and links.'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">
            <p className="text-text-muted">
              {isAr ? 'اللون المحفوظ:' : 'Saved:'}
              {' '}
              <span className="font-semibold text-text">{savedThemeLabel}</span>
              {' · '}
              <span className="font-semibold text-text">{savedThemeShadeLabel}</span>
            </p>
            {(selectedTheme !== savedTheme || selectedThemeShade !== savedThemeShade) && (
              <p className="mt-0.5 text-amber-700">
                {isAr ? 'المعاينة:' : 'Preview:'}
                {' '}
                <span className="font-semibold">{selectedThemeLabel}</span>
                {' · '}
                <span className="font-semibold">{selectedThemeShadeLabel}</span>
              </p>
            )}
            {savedRotation.enabled && (
              <p className="mt-0.5 text-primary-700">
                {isAr ? 'التبديل التلقائي: مفعّل' : 'Auto rotation: on'}
              </p>
            )}
          </div>
        </div>

        <ThemeRotationPanel
          rotation={selectedRotation}
          onChange={(next) => {
            userPickedRef.current = true;
            setSelectedRotation(normalizeThemeRotation(next, {
              color: selectedTheme,
              shade: selectedThemeShade,
            }));
          }}
          selectedTheme={selectedTheme}
          selectedThemeShade={selectedThemeShade}
          isAr={isAr}
        />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={colorQuery}
              onChange={(e) => setColorQuery(e.target.value)}
              placeholder={isAr ? 'ابحث بالاسم...' : 'Search by name...'}
              className="w-full rounded-xl border border-border bg-white py-2.5 ps-10 pe-3 text-sm outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSelectThemeShade(DEFAULT_THEME_COLOR, DEFAULT_THEME_SHADE)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            {isAr ? 'العودة للأخضر الافتراضي' : 'Reset to default green'}
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {THEME_GROUPS.map((item) => {
            const active = colorGroup === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setColorGroup(item.id)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-600 text-white'
                    : 'border border-border bg-white text-text-muted hover:border-primary-200 hover:text-text',
                ].join(' ')}
              >
                {isAr ? item.labelAr : item.labelEn}
              </button>
            );
          })}
        </div>

        {filteredThemes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد ألوان مطابقة — جرّب بحثاً أو فئة أخرى.' : 'No matching colors — try another search or category.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredThemes.map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                theme={theme}
                selected={selectedTheme === theme.id}
                active={savedTheme === theme.id}
                selectedShade={selectedThemeShade}
                savedShade={savedThemeShade}
                onSelect={handleSelectTheme}
                onSelectShade={handleSelectThemeShade}
                isAr={isAr}
                storeName={storeName}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          {isAr
            ? `${filteredThemes.length} من ${SITE_THEME_LIST.length} لون`
            : `${filteredThemes.length} of ${SITE_THEME_LIST.length} colors`}
        </p>
      </section>

      {hasUnsavedChanges && (
        <p className="text-sm text-amber-700">
          {isAr
            ? 'لديك تغييرات غير محفوظة — اضغط «حفظ المظهر» لتطبيقها على الموقع.'
            : 'You have unsaved changes — click Save appearance to apply them site-wide.'}
        </p>
      )}
    </form>
  );
}
