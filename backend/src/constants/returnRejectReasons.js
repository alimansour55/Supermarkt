/** Admin rejection reasons — keep in sync with frontend returnRejectReasons.js */

export const RETURN_REJECT_PRESETS = [
  {
    key: 'outside_window',
    labelAr: 'انتهت مهلة الإرجاع',
    labelEn: 'Return window expired',
    textAr: 'انتهت مهلة الإرجاع المسموحة (3 أيام من تاريخ التسليم) وفق سياسة المتجر.',
    textEn: 'The allowed return window (3 days from delivery) has expired per store policy.',
  },
  {
    key: 'not_eligible',
    labelAr: 'غير مؤهل للإرجاع',
    labelEn: 'Not eligible',
    textAr: 'هذا المنتج غير مؤهل للإرجاع حسب سياسة المتجر (مثل العروض الخاصة أو المستهلكات المفتوحة).',
    textEn: 'This product is not eligible for return under store policy (e.g. special offers or opened consumables).',
  },
  {
    key: 'condition_not_met',
    labelAr: 'حالة المنتج',
    labelEn: 'Product condition',
    textAr: 'المنتج مستخدم أو التغليف تالف/ناقص ولا يستوفي شروط الاسترجاع.',
    textEn: 'The product was used or packaging is damaged/incomplete and does not meet return conditions.',
  },
  {
    key: 'matches_delivery',
    labelAr: 'يطابق التسليم',
    labelEn: 'Matches delivery',
    textAr: 'المنتج المستلم يطابق ما تم تسليمه ولا يوجد عيب أو خطأ مثبت في الطلب.',
    textEn: 'The item received matches what was delivered; no defect or delivery error was verified.',
  },
  {
    key: 'insufficient_proof',
    labelAr: 'معلومات غير كافية',
    labelEn: 'Insufficient details',
    textAr: 'تفاصيل الطلب أو الصور المرسلة غير كافية للموافقة. يرجى التواصل معنا عبر رسائل الطلب.',
    textEn: 'Request details or photos are insufficient to approve. Please contact us via order messages.',
  },
  {
    key: 'partial_use',
    labelAr: 'استخدام جزئي',
    labelEn: 'Partial use',
    textAr: 'تم استهلاك جزء من المنتج (مثل أغذية أو مستحضرات مفتوحة) ولا يمكن استرجاعه.',
    textEn: 'Part of the product was consumed (e.g. opened food or cosmetics) and cannot be returned.',
  },
];

export const RETURN_REJECT_NOTE_MIN = 5;

export function validateReturnRejectNote(adminNote) {
  const note = (adminNote || '').trim();
  if (note.length < RETURN_REJECT_NOTE_MIN) {
    return {
      ok: false,
      message: `Rejection reason is required (at least ${RETURN_REJECT_NOTE_MIN} characters)`,
    };
  }
  return { ok: true, adminNote: note };
}
