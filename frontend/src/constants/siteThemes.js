export const DEFAULT_THEME_COLOR = 'hyperone';
export const DEFAULT_THEME_SHADE = 600;

export const THEME_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const THEME_GROUPS = [
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
  { id: 'fresh', labelAr: 'منعشة', labelEn: 'Fresh' },
  { id: 'cool', labelAr: 'باردة', labelEn: 'Cool' },
  { id: 'warm', labelAr: 'دافئة', labelEn: 'Warm' },
  { id: 'earth', labelAr: 'ترابية', labelEn: 'Earth' },
];

/** Full primary palette per theme — drives header, buttons, links, badges site-wide. */
export const SITE_THEMES = {
  hyperone: {
    id: 'hyperone',
    group: 'cool',
    labelAr: 'أزرق هايبر',
    labelEn: 'Hyper Blue',
    colors: {
      50: '#f2f6fb',
      100: '#e6eef7',
      200: '#cdddef',
      300: '#a8c0e2',
      400: '#6f93cc',
      500: '#3f6ab5',
      600: '#1d4ca1',
      700: '#17408a',
      800: '#123468',
      900: '#0b1a36',
    },
  },
  green: {
    id: 'green',
    group: 'fresh',
    labelAr: 'أخضر',
    labelEn: 'Green',
    colors: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
  },
  teal: {
    id: 'teal',
    group: 'cool',
    labelAr: 'تركواز',
    labelEn: 'Teal',
    colors: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
  },
  blue: {
    id: 'blue',
    group: 'cool',
    labelAr: 'أزرق',
    labelEn: 'Blue',
    colors: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
  },
  sky: {
    id: 'sky',
    group: 'cool',
    labelAr: 'سماوي',
    labelEn: 'Sky',
    colors: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
  },
  indigo: {
    id: 'indigo',
    group: 'cool',
    labelAr: 'نيلي',
    labelEn: 'Indigo',
    colors: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
  },
  purple: {
    id: 'purple',
    group: 'fresh',
    labelAr: 'بنفسجي',
    labelEn: 'Purple',
    colors: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
  },
  rose: {
    id: 'rose',
    group: 'warm',
    labelAr: 'وردي',
    labelEn: 'Rose',
    colors: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
    },
  },
  orange: {
    id: 'orange',
    group: 'warm',
    labelAr: 'برتقالي',
    labelEn: 'Orange',
    colors: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
  },
  amber: {
    id: 'amber',
    group: 'warm',
    labelAr: 'ذهبي',
    labelEn: 'Amber',
    colors: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
  },
  cyan: {
    id: 'cyan',
    group: 'cool',
    labelAr: 'سيان',
    labelEn: 'Cyan',
    colors: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
  },
  pink: {
    id: 'pink',
    group: 'fresh',
    labelAr: 'زهري',
    labelEn: 'Pink',
    colors: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#ec4899',
      600: '#db2777',
      700: '#be185d',
      800: '#9d174d',
      900: '#831843',
    },
  },
  fuchsia: {
    id: 'fuchsia',
    group: 'fresh',
    labelAr: 'فوشيا',
    labelEn: 'Fuchsia',
    colors: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef',
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
    },
  },
  red: {
    id: 'red',
    group: 'warm',
    labelAr: 'أحمر',
    labelEn: 'Red',
    colors: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
  },
  lime: {
    id: 'lime',
    group: 'fresh',
    labelAr: 'ليموني',
    labelEn: 'Lime',
    colors: {
      50: '#f7fee7',
      100: '#ecfccb',
      200: '#d9f99d',
      300: '#bef264',
      400: '#a3e635',
      500: '#84cc16',
      600: '#65a30d',
      700: '#4d7c0f',
      800: '#3f6212',
      900: '#365314',
    },
  },
  violet: {
    id: 'violet',
    group: 'cool',
    labelAr: 'بنفسجي فاتح',
    labelEn: 'Violet',
    colors: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
  },
  navy: {
    id: 'navy',
    group: 'cool',
    labelAr: 'كحلي',
    labelEn: 'Navy',
    colors: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  coral: {
    id: 'coral',
    group: 'warm',
    labelAr: 'مرجاني',
    labelEn: 'Coral',
    colors: {
      50: '#fff5f5',
      100: '#ffe8e5',
      200: '#ffc9c2',
      300: '#ffa399',
      400: '#ff7d6e',
      500: '#ff5c4d',
      600: '#e84a3d',
      700: '#c73b30',
      800: '#a33028',
      900: '#7f261f',
    },
  },
  wine: {
    id: 'wine',
    group: 'warm',
    labelAr: 'نبيذي',
    labelEn: 'Wine',
    colors: {
      50: '#fdf2f7',
      100: '#fae1ec',
      200: '#f3bfd4',
      300: '#e08faa',
      400: '#c45d82',
      500: '#a63d66',
      600: '#8b2f56',
      700: '#72264a',
      800: '#5c1f3c',
      900: '#451830',
    },
  },
  chocolate: {
    id: 'chocolate',
    group: 'earth',
    labelAr: 'شوكولاتي',
    labelEn: 'Chocolate',
    colors: {
      50: '#fdf8f6',
      100: '#f2e8e5',
      200: '#eaddd7',
      300: '#d6c0b3',
      400: '#b8957a',
      500: '#9a734f',
      600: '#7d5a3c',
      700: '#634630',
      800: '#4f3726',
      900: '#3d2b1e',
    },
  },
  bronze: {
    id: 'bronze',
    group: 'earth',
    labelAr: 'برونزي',
    labelEn: 'Bronze',
    colors: {
      50: '#fdfaf3',
      100: '#f8f0e3',
      200: '#eddcc0',
      300: '#d9bc8a',
      400: '#c49a5a',
      500: '#a67c3d',
      600: '#8a6330',
      700: '#6f4f27',
      800: '#573e1f',
      900: '#432f18',
    },
  },
};

export const SITE_THEME_LIST = Object.values(SITE_THEMES);

export function resolveThemeColor(themeKey) {
  const key = String(themeKey || '').trim();
  return SITE_THEMES[key] ? key : DEFAULT_THEME_COLOR;
}

export function resolveThemeShade(shade) {
  const n = Number(shade);
  return THEME_SHADES.includes(n) ? n : DEFAULT_THEME_SHADE;
}

/** Shift palette so the chosen shade becomes the site "600" anchor (lighter or darker overall). */
export function remapThemePalette(colors, anchorShade = DEFAULT_THEME_SHADE) {
  const anchor = resolveThemeShade(anchorShade);
  const anchorIdx = THEME_SHADES.indexOf(anchor);
  const defaultIdx = THEME_SHADES.indexOf(DEFAULT_THEME_SHADE);
  const offset = anchorIdx - defaultIdx;

  const remapped = {};
  THEME_SHADES.forEach((shade, i) => {
    const sourceIdx = Math.max(0, Math.min(THEME_SHADES.length - 1, i + offset));
    remapped[shade] = colors[THEME_SHADES[sourceIdx]];
  });
  return remapped;
}

export function getThemeColors(themeKey, themeShade = DEFAULT_THEME_SHADE) {
  const theme = getTheme(themeKey);
  return remapThemePalette(theme.colors, themeShade);
}

export function getTheme(themeKey, themeShade) {
  const key = resolveThemeColor(themeKey);
  const base = SITE_THEMES[key] || SITE_THEMES[DEFAULT_THEME_COLOR];
  if (themeShade === undefined) return base;
  return {
    ...base,
    colors: remapThemePalette(base.colors, themeShade),
  };
}

export function getThemePrimaryColor(themeKey, themeShade = DEFAULT_THEME_SHADE) {
  return getThemeColors(themeKey, themeShade)[600];
}

export function getThemeShadeLabel(shade, isAr = false) {
  const n = resolveThemeShade(shade);
  if (isAr) {
    if (n <= 200) return 'فاتح جداً';
    if (n <= 400) return 'فاتح';
    if (n <= 600) return 'متوسط';
    if (n <= 800) return 'غامق';
    return 'غامق جداً';
  }
  if (n <= 200) return 'Very light';
  if (n <= 400) return 'Light';
  if (n <= 600) return 'Medium';
  if (n <= 800) return 'Dark';
  return 'Very dark';
}

export function filterThemes({ query = '', group = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return SITE_THEME_LIST.filter((theme) => {
    if (group !== 'all' && theme.group !== group) return false;
    if (!q) return true;
    return (
      theme.id.includes(q)
      || theme.labelAr.includes(q)
      || theme.labelEn.toLowerCase().includes(q)
    );
  });
}
