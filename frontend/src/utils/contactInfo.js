export function normalizePhoneTel(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `tel:${digits}` : '';
}

/**
 * Canonical "+<digits>" form for display, regardless of how the admin typed
 * the separator/plus sign (e.g. a trailing "+" from a copy-paste mistake).
 */
export function formatPhoneDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Build a wa.me deep link — opens the customer's or staff's own WhatsApp
 * (app or web) prefilled with a message. Works with no API/credentials;
 * this is a manual handoff, not a programmatic send.
 */
export function buildWhatsAppLink(phone, text = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/**
 * Resolve the admin-configured customer-service channels (call, callback,
 * chat, email, WhatsApp, custom links). Falls back to the legacy
 * supportPhone/supportEmail/whatsappUrl fields when nothing is configured yet
 * (e.g. right after upgrading, before the settings have been re-saved).
 */
export function getCustomerServiceChannels(settings, isAr) {
  if (settings?.customerService?.enabled === false) return [];

  const configured = settings?.customerService?.channels;
  if (Array.isArray(configured) && configured.length) {
    return [...configured]
      .filter((ch) => ch.enabled !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((ch) => ({
        id: ch.id,
        type: ch.type,
        label: (isAr ? ch.labelAr : ch.labelEn) || ch.labelAr || ch.labelEn || '',
        description: (isAr ? ch.descriptionAr : ch.descriptionEn) || '',
        value: ch.value || '',
      }));
  }

  const legacy = [];
  if (settings?.supportPhone) {
    legacy.push({ id: 'phone', type: 'phone', label: isAr ? 'اتصال هاتفي' : 'Phone call', description: '', value: settings.supportPhone });
  }
  legacy.push({ id: 'callback', type: 'callback', label: isAr ? 'اطلب أن نتصل بك' : 'Request a call back', description: '', value: '' });
  legacy.push({ id: 'chat', type: 'chat', label: isAr ? 'الدردشة المباشرة' : 'Live chat', description: '', value: '' });
  if (settings?.supportEmail) {
    legacy.push({ id: 'email', type: 'email', label: isAr ? 'البريد الإلكتروني' : 'Email', description: '', value: settings.supportEmail });
  }
  if (settings?.whatsappUrl) {
    legacy.push({ id: 'whatsapp', type: 'whatsapp', label: 'WhatsApp', description: '', value: settings.whatsappUrl });
  }
  return legacy;
}

export function buildContactInfoRows(settings, isAr) {
  const rows = [];
  getCustomerServiceChannels(settings, isAr).forEach((ch) => {
    if (ch.type === 'phone' && ch.value) rows.push({ label: isAr ? 'هاتف' : 'Phone', value: ch.value });
    if (ch.type === 'email' && ch.value) rows.push({ label: isAr ? 'بريد إلكتروني' : 'Email', value: ch.value });
    if (ch.type === 'whatsapp' && ch.value) rows.push({ label: 'WhatsApp', value: isAr ? 'متاح للتواصل' : 'Available' });
  });
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

/**
 * Actionable buttons for each enabled channel. Channels without a direct link
 * (callback, chat) get a bare action id that the caller must handle locally —
 * `contact_callback` should open the callback-request form, `contact_chat`
 * should open the assistant chat widget.
 */
export function buildContactQuickActions(settings, isAr, { excludeTypes = [] } = {}) {
  const channels = getCustomerServiceChannels(settings, isAr)
    .filter((ch) => !excludeTypes.includes(ch.type));

  const actions = channels.map((ch) => {
    switch (ch.type) {
      case 'phone': {
        const tel = normalizePhoneTel(ch.value);
        return tel ? { id: 'contact_call', label: ch.label, icon: 'contact', href: tel } : null;
      }
      case 'email':
        return ch.value ? { id: 'contact_email', label: ch.label, icon: 'contact', href: `mailto:${ch.value}` } : null;
      case 'whatsapp':
        return ch.value ? { id: 'whatsapp', label: ch.label || 'WhatsApp', icon: 'whatsapp', href: ch.value, external: true } : null;
      case 'callback':
        return { id: 'contact_callback', label: ch.label, icon: 'contact' };
      case 'chat':
        return { id: 'contact_chat', label: ch.label, icon: 'contact' };
      case 'custom':
        return ch.value ? { id: `contact_custom_${ch.id}`, label: ch.label, icon: 'contact', href: ch.value, external: true } : null;
      default:
        return null;
    }
  }).filter(Boolean);

  if (actions.length) actions[0] = { ...actions[0], variant: 'primary' };
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
