import {
  DEFAULT_PRODUCT_FILTER_SECTIONS,
  DEFAULT_PRODUCT_SOURCE_OPTIONS,
  PRODUCT_FILTER_SECTION_IDS,
  PRODUCT_SOURCE_OPTION_IDS,
} from '../constants/productFilterSettings';

function normalizeSections(rawSections = []) {
  const byId = new Map();
  (Array.isArray(rawSections) ? rawSections : []).forEach((row, index) => {
    if (!row?.id || !PRODUCT_FILTER_SECTION_IDS.includes(row.id)) return;
    byId.set(row.id, {
      id: row.id,
      enabled: row.enabled !== false,
      sortOrder: Number(row.sortOrder ?? index),
    });
  });

  DEFAULT_PRODUCT_FILTER_SECTIONS.forEach((fallback, index) => {
    if (!byId.has(fallback.id)) {
      byId.set(fallback.id, { ...fallback, sortOrder: fallback.sortOrder ?? index });
    }
  });

  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function normalizeSourceOptions(rawOptions = []) {
  const byId = new Map();
  (Array.isArray(rawOptions) ? rawOptions : []).forEach((row, index) => {
    if (!row?.id || !PRODUCT_SOURCE_OPTION_IDS.includes(row.id)) return;
    const fallback = DEFAULT_PRODUCT_SOURCE_OPTIONS.find((opt) => opt.id === row.id);
    byId.set(row.id, {
      id: row.id,
      labelAr: String(row.labelAr || fallback?.labelAr || '').trim() || fallback?.labelAr || '',
      labelEn: String(row.labelEn || fallback?.labelEn || '').trim() || fallback?.labelEn || '',
      enabled: row.enabled !== false,
      sortOrder: Number(row.sortOrder ?? index),
    });
  });

  DEFAULT_PRODUCT_SOURCE_OPTIONS.forEach((fallback, index) => {
    if (!byId.has(fallback.id)) {
      byId.set(fallback.id, { ...fallback, sortOrder: fallback.sortOrder ?? index });
    }
  });

  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function normalizeProductFilterSettings(raw = {}) {
  return {
    sections: normalizeSections(raw.sections),
    sourceOptions: normalizeSourceOptions(raw.sourceOptions),
  };
}

export function getEnabledFilterSections(settings, { hideMainCategory, hideSubCategory, hideOffersFilter } = {}) {
  const normalized = normalizeProductFilterSettings(settings || {});
  return normalized.sections.filter((section) => {
    if (!section.enabled) return false;
    if (hideMainCategory && section.id === 'mainCategory') return false;
    if (hideSubCategory && section.id === 'subCategory') return false;
    if (hideOffersFilter && section.id === 'quickFilters') return false;
    return true;
  });
}

export function getEnabledSourceOptions(settings, meta) {
  const normalized = normalizeProductFilterSettings(settings || {});
  const counts = new Map((meta?.productSources || []).map((row) => [row.id, row.count]));
  const labels = new Map((meta?.productSources || []).map((row) => [row.id, row]));

  return normalized.sourceOptions
    .filter((opt) => opt.enabled !== false)
    .map((opt) => {
      const fromMeta = labels.get(opt.id);
      return {
        ...opt,
        labelAr: fromMeta?.labelAr || opt.labelAr,
        labelEn: fromMeta?.labelEn || opt.labelEn,
        count: counts.get(opt.id),
      };
    });
}

export function sourceOptionLabel(option, isAr) {
  if (!option) return '';
  return isAr ? (option.labelAr || option.labelEn) : (option.labelEn || option.labelAr);
}
