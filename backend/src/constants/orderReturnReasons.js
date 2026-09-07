export const RETURN_WINDOW_DAYS = 3;

export const RETURN_REASON_PRESETS = [
  {
    key: 'damaged',
    labelAr: 'المنتج تالف أو مكسور',
    labelEn: 'Product damaged or broken',
  },
  {
    key: 'wrong_item',
    labelAr: 'تم استلام منتج خاطئ',
    labelEn: 'Received wrong item',
  },
  {
    key: 'missing_parts',
    labelAr: 'ناقص أو غير مكتمل',
    labelEn: 'Missing parts or incomplete',
  },
  {
    key: 'quality',
    labelAr: 'الجودة غير مقبولة',
    labelEn: 'Quality not acceptable',
  },
  {
    key: 'expired',
    labelAr: 'منتهي الصلاحية أو قريب الانتهاء',
    labelEn: 'Expired or near expiry',
  },
];

export function getReturnReasonPreset(key) {
  return RETURN_REASON_PRESETS.find((p) => p.key === key) || null;
}

export function resolveReturnReason({ reasonKey, reasonNote }) {
  const key = (reasonKey || '').trim();
  const note = (reasonNote || '').trim();

  if (key && key !== 'custom') {
    const preset = getReturnReasonPreset(key);
    if (!preset) return { ok: false, message: 'Invalid return reason' };
    return {
      ok: true,
      reasonKey: key,
      reasonAr: preset.labelAr,
      reasonEn: preset.labelEn,
    };
  }

  if (!note || note.length < 3) {
    return { ok: false, message: 'Please describe the return reason (at least 3 characters)' };
  }

  return {
    ok: true,
    reasonKey: 'custom',
    reasonAr: note,
    reasonEn: note,
  };
}
