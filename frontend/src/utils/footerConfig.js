/**
 * Footer configuration helpers shared by the storefront `Footer.jsx` and the
 * admin Header & Footer CMS preview. The stored shape lives at
 * `storeSettings.navigation.footer` (see `StoreSettings.js` navigationSchema).
 * All fields are optional — empty / missing means "use the built-in default",
 * so an un-customized store renders exactly as before.
 */

export const DEFAULT_FOOTER_LEGAL_LINKS = [
  { labelAr: 'سياسة الإرجاع', labelEn: 'Return Policy', href: '/returns' },
  { labelAr: 'سياسة الخصوصية', labelEn: 'Privacy Policy', href: '/privacy' },
  { labelAr: 'الشروط والأحكام', labelEn: 'Terms & Conditions', href: '/terms' },
];

export const DEFAULT_FOOTER_PAYMENT_METHODS = ['visa', 'mastercard'];

export const FOOTER_PAYMENT_OPTIONS = [
  'visa', 'mastercard', 'meeza', 'valu', 'fawry', 'instapay', 'vodafone-cash',
];

export const FOOTER_SECTIONS = ['backToTop', 'social', 'contact', 'apps', 'payment', 'legal'];

/** A footer section shows unless it has been explicitly turned off. */
export function footerSectionEnabled(footer, section) {
  const key = `show${section.charAt(0).toUpperCase()}${section.slice(1)}`;
  return footer?.[key] !== false;
}

/** Normalize the `navigation.footer` sub-object (client + mirrors server rules). */
export function normalizeFooterConfig(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const bool = (v) => v !== false;
  const legalLinks = (Array.isArray(src.legalLinks) ? src.legalLinks : [])
    .map((l) => ({
      labelAr: String(l?.labelAr ?? '').trim().slice(0, 120),
      labelEn: String(l?.labelEn ?? '').trim().slice(0, 120),
      href: String(l?.href ?? '/').trim().slice(0, 400) || '/',
      isExternal: l?.isExternal === true,
    }))
    .filter((l) => l.labelAr || l.labelEn)
    .slice(0, 12);
  const paymentMethods = [...new Set(
    (Array.isArray(src.paymentMethods) ? src.paymentMethods : []).filter((m) => FOOTER_PAYMENT_OPTIONS.includes(m)),
  )].slice(0, 8);

  return {
    showBackToTop: bool(src.showBackToTop),
    showSocial: bool(src.showSocial),
    showContact: bool(src.showContact),
    showApps: bool(src.showApps),
    showPayment: bool(src.showPayment),
    showLegal: bool(src.showLegal),
    legalLinks,
    paymentMethods,
  };
}
