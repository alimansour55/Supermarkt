import { Check, X } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice } from '../../utils/formatters';

export default function OrderSubstitutions({
  substitutions = [],
  isAr,
  onRespond,
  responding,
}) {
  const pending = substitutions.filter((s) => s.status === 'pending');
  if (!substitutions.length) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-amber-900">
        {isAr ? 'اقتراحات بديلة' : 'Substitution suggestions'}
      </h3>
      <div className="space-y-3">
        {substitutions.map((sub) => (
          <div key={sub._id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
            <p className="text-text-muted">
              {isAr ? 'بدلاً من' : 'Instead of'}{' '}
              <span className="font-medium text-text">{isAr ? sub.original?.nameAr : sub.original?.nameEn}</span>
            </p>
            <p className="mt-1">
              {isAr ? 'البديل المقترح:' : 'Suggested:'}{' '}
              <span className="font-semibold text-primary-700">
                {isAr ? sub.replacement?.nameAr : sub.replacement?.nameEn}
              </span>
              {' · '}
              {formatPrice(sub.replacement?.price)}
            </p>
            {sub.reason && (
              <p className="mt-1 text-text-muted">{sub.reason}</p>
            )}
            {sub.priceDifference !== 0 && (
              <p className="mt-1 text-xs text-text-muted">
                {isAr ? 'فرق السعر:' : 'Price difference:'}{' '}
                {sub.priceDifference > 0 ? '+' : ''}{formatPrice(sub.priceDifference)}
              </p>
            )}
            {sub.status === 'pending' ? (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={responding}
                  onClick={() => onRespond(sub._id, 'accept')}
                >
                  <Check className="h-4 w-4" />
                  {isAr ? 'قبول' : 'Accept'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={responding}
                  onClick={() => onRespond(sub._id, 'reject')}
                >
                  <X className="h-4 w-4" />
                  {isAr ? 'رفض' : 'Reject'}
                </Button>
              </div>
            ) : (
              <p className={`mt-2 text-xs font-semibold ${sub.status === 'accepted' ? 'text-green-700' : 'text-red-600'}`}>
                {sub.status === 'accepted'
                  ? (isAr ? 'تم القبول' : 'Accepted')
                  : (isAr ? 'تم الرفض' : 'Rejected')}
              </p>
            )}
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          {isAr ? `${pending.length} اقتراح بانتظار ردك` : `${pending.length} suggestion(s) awaiting your response`}
        </p>
      )}
    </section>
  );
}
