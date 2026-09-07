export function normalizePhoneTel(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `tel:${digits}` : '';
}

export function buildContactInfoRows(settings, isAr) {
  const rows = [];
  if (settings?.supportPhone) {
    rows.push({ label: isAr ? 'هاتف' : 'Phone', value: settings.supportPhone });
  }
  if (settings?.supportEmail) {
    rows.push({ label: isAr ? 'بريد إلكتروني' : 'Email', value: settings.supportEmail });
  }
  if (settings?.whatsappUrl) {
    rows.push({ label: 'WhatsApp', value: isAr ? 'متاح للتواصل' : 'Available' });
  }
  const promise = isAr ? settings?.deliveryPromiseAr : settings?.deliveryPromiseEn;
  if (promise) {
    rows.push({ label: isAr ? 'وعد التوصيل' : 'Delivery promise', value: promise });
  }
  const location = isAr ? settings?.defaultLocationAr : settings?.defaultLocationEn;
  if (location) {
    rows.push({ label: isAr ? 'منطقة الخدمة' : 'Service area', value: location });
  }
  return rows;
}

export function buildContactQuickActions(settings, isAr) {
  const actions = [];
  const phoneTel = normalizePhoneTel(settings?.supportPhone);

  if (phoneTel) {
    actions.push({
      id: 'contact_call',
      label: isAr ? 'اتصل الآن' : 'Call now',
      icon: 'contact',
      href: phoneTel,
      variant: 'primary',
    });
  }
  if (settings?.whatsappUrl) {
    actions.push({
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'whatsapp',
      href: settings.whatsappUrl,
      external: true,
      variant: !phoneTel ? 'primary' : undefined,
    });
  }
  if (settings?.supportEmail) {
    actions.push({
      id: 'contact_email',
      label: isAr ? 'راسلنا بالبريد' : 'Email us',
      icon: 'contact',
      href: `mailto:${settings.supportEmail}`,
    });
  }
  return actions;
}

export function isLegacyContactSection(section) {
  const headingAr = (section?.headingAr || '').trim();
  const headingEn = (section?.headingEn || '').trim().toLowerCase();
  return headingAr === 'خدمة العملاء' || headingEn === 'customer service';
}

export function filterContactPageSections(sections = []) {
  return sections.filter((section) => !isLegacyContactSection(section));
}
