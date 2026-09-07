import { DELIVERY_METHODS } from '../../constants/deliveryOptions';

const METHOD_IDS = ['scheduled', 'express', 'recurring'];

export default function FreeDeliveryMethodsField({
  value = [],
  onChange,
  isAr,
  label,
  hint,
  disabled = false,
}) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (id) => {
    if (disabled) return;
    const next = selected.includes(id)
      ? selected.filter((m) => m !== id)
      : [...selected, id];
    if (next.length) onChange([...next]);
  };

  return (
    <div className={`md:col-span-2 space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <p className="text-sm font-semibold text-text">
        {label || (isAr ? 'التوصيل المجاني ينطبق على' : 'Free delivery applies to')}
      </p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-3">
        {METHOD_IDS.map((id) => {
          const meta = DELIVERY_METHODS[id];
          const checked = selected.includes(id);
          return (
            <label
              key={id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                disabled ? 'cursor-not-allowed border-border bg-slate-100' : 'cursor-pointer'
              } ${
                !disabled && checked ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800' : 'border-border'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => {
                  e.stopPropagation();
                  toggle(id);
                }}
                className="accent-primary-600"
              />
              {isAr ? meta.labelAr : meta.labelEn}
            </label>
          );
        })}
      </div>
    </div>
  );
}
