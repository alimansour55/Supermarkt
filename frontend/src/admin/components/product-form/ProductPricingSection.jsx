import Input from '../../../components/ui/Input';
import { CUSTOM_UNIT_VALUE, PRODUCT_UNITS, findUnitOption } from '../../../constants/productUnits';

function formatDateTime(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ProductPricingSection({ register, watch, setValue, errors, isAr, meta, isEdit }) {
  const price = watch('price');
  const wholesalePrice = watch('wholesalePrice');
  const unit = watch('unit');

  const sellPrice = Number(price) || 0;
  const wholesale = Number(wholesalePrice) || 0;
  const unitProfit = sellPrice - wholesale;
  const marginPct = sellPrice > 0 ? Math.round((unitProfit / sellPrice) * 1000) / 10 : 0;
  const isCustomUnit = !findUnitOption(unit);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={isAr ? 'سعر البيع' : 'Selling price'}
        type="number"
        step="0.01"
        min="0"
        error={errors.price?.message}
        required
        {...register('price')}
      />
      <Input
        label={isAr ? 'سعر الجملة' : 'Wholesale price'}
        type="number"
        step="0.01"
        min="0"
        error={errors.wholesalePrice?.message}
        {...register('wholesalePrice')}
      />
      <Input
        label={isAr ? 'السعر القديم (عرض)' : 'Old price (promo)'}
        type="number"
        step="0.01"
        min="0"
        error={errors.oldPrice?.message}
        {...register('oldPrice')}
      />

      {(sellPrice > 0 || wholesale > 0) && (
        <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">{isAr ? 'الربح للوحدة' : 'Profit per unit'}</p>
          <p className="mt-1">
            {isAr ? 'الفرق (بيع − جملة):' : 'Margin (sell − wholesale):'}{' '}
            <span className="font-bold">{unitProfit >= 0 ? '+' : ''}{unitProfit.toFixed(2)} EGP</span>
            {sellPrice > 0 && (
              <span className="text-emerald-800">
                {' '}
                ({marginPct}% {isAr ? 'من سعر البيع' : 'of selling price'})
              </span>
            )}
          </p>
        </div>
      )}

      <div>
        <Input
          label={isAr ? 'المخزون' : 'Stock'}
          type="number"
          min="0"
          placeholder="0"
          error={errors.stock?.message}
          required
          {...register('stock')}
        />
        {isEdit && meta.stockHistory?.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary-600">
              {isAr ? 'سجل المخزون' : 'Stock history'}
            </summary>
            <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-text-muted">
              {meta.stockHistory.slice(0, 8).map((entry, i) => (
                <li key={i}>
                  {entry.previousStock} → {entry.stock}
                  {' · '}
                  {formatDateTime(entry.changedAt, isAr)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-text">
          {isAr ? 'الوحدة' : 'Unit'}
        </label>
        <select
          className="w-full rounded-field border border-border bg-white px-4 py-2.5 text-text transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          value={isCustomUnit ? CUSTOM_UNIT_VALUE : unit}
          onChange={(e) => {
            const val = e.target.value;
            if (val === CUSTOM_UNIT_VALUE) {
              setValue('unit', '', { shouldDirty: true });
              setValue('unitAr', '', { shouldDirty: true });
              setValue('unitEn', '', { shouldDirty: true });
              return;
            }
            const option = findUnitOption(val);
            setValue('unit', val, { shouldDirty: true });
            setValue('unitAr', option?.ar || '', { shouldDirty: true });
            setValue('unitEn', option?.en || '', { shouldDirty: true });
          }}
        >
          {PRODUCT_UNITS.map((u) => (
            <option key={u.value} value={u.value}>{isAr ? u.ar : u.en}</option>
          ))}
          <option value={CUSTOM_UNIT_VALUE}>{isAr ? 'أخرى (تحديد يدوي)' : 'Other (custom)'}</option>
        </select>
        {isCustomUnit && (
          <input
            className="mt-2 w-full rounded-field border border-border bg-white px-4 py-2.5 text-text placeholder:text-text-muted transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder={isAr ? 'اكتب اسم الوحدة' : 'Type the unit name'}
            value={unit}
            onChange={(e) => {
              const val = e.target.value;
              setValue('unit', val, { shouldDirty: true });
              setValue('unitAr', val, { shouldDirty: true });
              setValue('unitEn', val, { shouldDirty: true });
            }}
          />
        )}
      </div>
    </div>
  );
}
