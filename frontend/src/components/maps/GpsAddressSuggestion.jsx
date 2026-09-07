import { Check, MapPin, Pencil } from 'lucide-react';
import Button from '../ui/Button';

function formatSuggestionLine(addr, isAr) {
  return [
    addr.street,
    addr.building && (isAr ? `مبنى ${addr.building}` : `Bldg ${addr.building}`),
    addr.area,
    addr.city,
  ].filter(Boolean).join(isAr ? '، ' : ', ');
}

export default function GpsAddressSuggestion({
  suggestion,
  isAr = false,
  onAccept,
  onManual,
  partial = false,
}) {
  if (!suggestion) return null;

  const line = formatSuggestionLine(suggestion, isAr);

  return (
    <div className="rounded-2xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-primary-950">
            {partial
              ? (isAr ? 'تم تحديد موقعك على الخريطة' : 'Your map pin is set')
              : (isAr ? 'اقتراح عنوان من موقعك الحالي' : 'Suggested address from your location')}
          </p>
          <p className="mt-1 text-xs text-primary-900/80">
            {partial
              ? (isAr
                ? 'تم تحديد موقعك على الخريطة. أضف رقم المبنى والشارع إن لزم.'
                : 'Your pin is set. Add building and street details if needed.')
              : (isAr
                ? 'راجع العنوان المقترح ثم أكّده. يمكنك تعديل رقم المبنى أو الشقة قبل الطلب.'
                : 'Review the suggested address and confirm. You can edit building or apartment before ordering.')}
          </p>
        </div>
      </div>

      {suggestion.formattedAddress && (
        <p className="mb-2 rounded-xl bg-white/80 px-3 py-2 text-sm leading-relaxed text-slate-700">
          {suggestion.formattedAddress}
        </p>
      )}

      {line && (
        <dl className="mb-4 grid gap-2 rounded-xl border border-primary-100 bg-white/70 px-3 py-2 text-xs sm:grid-cols-2">
          {suggestion.street && (
            <div>
              <dt className="font-semibold text-slate-500">{isAr ? 'الشارع' : 'Street'}</dt>
              <dd className="text-slate-800">{suggestion.street}</dd>
            </div>
          )}
          {suggestion.area && (
            <div>
              <dt className="font-semibold text-slate-500">{isAr ? 'المنطقة' : 'Area'}</dt>
              <dd className="text-slate-800">{suggestion.area}</dd>
            </div>
          )}
          {suggestion.city && (
            <div>
              <dt className="font-semibold text-slate-500">{isAr ? 'المدينة' : 'City'}</dt>
              <dd className="text-slate-800">{suggestion.city}</dd>
            </div>
          )}
          {suggestion.building && (
            <div>
              <dt className="font-semibold text-slate-500">{isAr ? 'المبنى' : 'Building'}</dt>
              <dd className="text-slate-800">{suggestion.building}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" onClick={onAccept}>
          <Check className="h-4 w-4" />
          {partial
            ? (isAr ? 'تأكيد الموقع ومتابعة' : 'Confirm pin & continue')
            : (isAr ? 'استخدام هذا العنوان' : 'Use this address')}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onManual}>
          <Pencil className="h-4 w-4" />
          {isAr ? 'إدخال يدوي' : 'Enter manually'}
        </Button>
      </div>
    </div>
  );
}
