import {
  DEFAULT_PRODUCT_FILTER_SETTINGS,
  DEFAULT_PRODUCT_FILTER_SECTIONS,
  DEFAULT_PRODUCT_SOURCE_OPTIONS,
  PRODUCT_FILTER_SECTION_IDS,
  PRODUCT_SOURCE_OPTION_IDS,
} from '../constants/productFilterSettings.js';

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

export function getDefaultProductFilterSettings() {
  return normalizeProductFilterSettings(DEFAULT_PRODUCT_FILTER_SETTINGS);
}
