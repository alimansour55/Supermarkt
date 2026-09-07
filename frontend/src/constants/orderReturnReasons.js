export const RETURN_WINDOW_DAYS = 3;

export const RETURN_REASON_PRESETS = [
  { key: 'damaged', labelAr: 'المنتج تالف أو مكسور', labelEn: 'Product damaged or broken' },
  { key: 'wrong_item', labelAr: 'تم استلام منتج خاطئ', labelEn: 'Received wrong item' },
  { key: 'missing_parts', labelAr: 'ناقص أو غير مكتمل', labelEn: 'Missing parts or incomplete' },
  { key: 'quality', labelAr: 'الجودة غير مقبولة', labelEn: 'Quality not acceptable' },
  { key: 'expired', labelAr: 'منتهي الصلاحية أو قريب الانتهاء', labelEn: 'Expired or near expiry' },
];

export function getReturnReasonLabel(ret, isAr) {
  if (!ret) return '';
  if (isAr) return ret.reasonAr || ret.reasonEn || '';
  return ret.reasonEn || ret.reasonAr || '';
}

export function getReturnStatusLabel(status, isAr) {
  const map = {
    pending: { ar: 'بانتظار الموافقة', en: 'Awaiting approval' },
    approved: { ar: 'تمت الموافقة', en: 'Approved' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
  };
  const row = map[status] || map.pending;
  return isAr ? row.ar : row.en;
}
