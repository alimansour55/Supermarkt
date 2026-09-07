import { useMemo, useState } from 'react';
import { CalendarDays, Truck, Store } from 'lucide-react';
import Button from '../ui/Button';
import ProductImage from '../ui/ProductImage';
import {
  RETURN_ITEM_CONDITIONS,
  RETURN_METHODS,
  RETURN_PICKUP_SLOTS,
  maxPickupDateInputValue,
  todayDateInputValue,
} from '../../constants/returnPickup';
import { RETURN_REASON_PRESETS } from '../../constants/orderReturnReasons';

export default function ReturnRequestForm({
  order,
  isAr,
  returnable,
  submitting,
  onSubmit,
  onCancel,
}) {
  const returnableIndexes = useMemo(
    () => (order.items || [])
      .map((_, i) => i)
      .filter((i) => (returnable[i] || 0) > 0),
    [order.items, returnable],
  );

  const [itemIndex, setItemIndex] = useState(String(returnableIndexes[0] ?? 0));
  const [quantity, setQuantity] = useState(1);
  const [reasonKey, setReasonKey] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [note, setNote] = useState('');
  const [returnMethod, setReturnMethod] = useState('store_dropoff');
  const [pickupDate, setPickupDate] = useState(todayDateInputValue());
  const [pickupSlotId, setPickupSlotId] = useState(RETURN_PICKUP_SLOTS[0]?.id || '');
  const [itemCondition, setItemCondition] = useState('unopened');
  const [contactPhone, setContactPhone] = useState(order.phone || '');

  const idx = Number(itemIndex);
  const maxQty = returnable[idx] || 0;
  const minDate = todayDateInputValue();
  const maxDate = maxPickupDateInputValue(order.returnDeadline);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (maxQty < 1 || !onSubmit) return;
    const qty = Math.min(Math.max(1, Number(quantity) || 1), maxQty);
    onSubmit({
      itemIndex: idx,
      quantity: qty,
      reasonKey: reasonKey === 'custom' ? 'custom' : reasonKey,
      reasonNote: reasonKey === 'custom' ? customReason.trim() : '',
      customerNote: note.trim(),
      returnMethod,
      pickupDate,
      pickupSlotId,
      itemCondition,
      contactPhone: contactPhone.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-primary-200 bg-gradient-to-b from-primary-50/50 to-white p-4 sm:p-5">
      <div>
        <h3 className="text-base font-bold text-text">
          {isAr ? 'طلب إرجاع جديد' : 'New return request'}
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          {isAr
            ? 'اختر المنتج، السبب، وموعد إرجاع المنتج للمتجر (فرع أو استلام من المنزل).'
            : 'Choose the product, reason, and when/how you will return it to the store.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-text-muted">
            {isAr ? 'المنتج' : 'Product'}
          </label>
          <select
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            value={itemIndex}
            onChange={(e) => {
              setItemIndex(e.target.value);
              setQuantity(1);
            }}
          >
            {returnableIndexes.map((i) => {
              const item = order.items[i];
              const max = returnable[i] || 0;
              return (
                <option key={i} value={String(i)}>
                  {isAr ? item.nameAr : item.nameEn || item.nameAr}
                  {' '}
                  ({isAr ? `متاح: ${max}` : `available: ${max}`})
                </option>
              );
            })}
          </select>
        </div>

        {maxQty > 0 && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <ProductImage
              src={order.items[idx]?.image}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">
                {isAr ? 'الكمية' : 'Quantity'}
              </label>
              <input
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-28 rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-text-muted">
          {isAr ? 'سبب الإرجاع' : 'Return reason'}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RETURN_REASON_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className={[
                'flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition',
                reasonKey === preset.key
                  ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-300'
                  : 'border-border bg-white hover:border-primary-200',
              ].join(' ')}
            >
              <input
                type="radio"
                name="returnReason"
                value={preset.key}
                checked={reasonKey === preset.key}
                onChange={() => setReasonKey(preset.key)}
                className="mt-1"
              />
              <span>{isAr ? preset.labelAr : preset.labelEn}</span>
            </label>
          ))}
          <label
            className={[
              'flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm sm:col-span-2',
              reasonKey === 'custom'
                ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-300'
                : 'border-border bg-white',
            ].join(' ')}
          >
            <input
              type="radio"
              name="returnReason"
              value="custom"
              checked={reasonKey === 'custom'}
              onChange={() => setReasonKey('custom')}
              className="mt-1"
            />
            <span>{isAr ? 'سبب آخر' : 'Other reason'}</span>
          </label>
        </div>
        {reasonKey === 'custom' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            rows={2}
            placeholder={isAr ? 'اشرح السبب...' : 'Describe the reason...'}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          />
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-muted">
          <Truck className="h-4 w-4" />
          {isAr ? 'طريقة إرجاع المنتج' : 'How will you return the product?'}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RETURN_METHODS.map((method) => {
            const Icon = method.id === 'home_pickup' ? Truck : Store;
            const active = returnMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setReturnMethod(method.id)}
                className={[
                  'rounded-xl border p-3 text-start text-sm transition',
                  active
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                    : 'border-border bg-white hover:border-primary-200',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 font-semibold text-text">
                  <Icon className="h-4 w-4 text-primary-600" />
                  {isAr ? method.labelAr : method.labelEn}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {isAr ? method.descriptionAr : method.descriptionEn}
                </p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-900">
          <CalendarDays className="h-4 w-4" />
          {isAr ? 'موعد الإرجاع' : 'Return appointment'}
        </legend>
        <p className="text-xs text-amber-800/90">
          {isAr
            ? 'اختر اليوم والفترة المناسبة لإحضار المنتج أو استلامه من منزلك.'
            : 'Pick the day and time window that works for drop-off or home pickup.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">
              {isAr ? 'اليوم' : 'Date'}
            </label>
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">
              {isAr ? 'الفترة' : 'Time slot'}
            </label>
            <select
              value={pickupSlotId}
              onChange={(e) => setPickupSlotId(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              required
            >
              {RETURN_PICKUP_SLOTS.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {isAr ? slot.labelAr : slot.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">
            {isAr ? 'حالة المنتج عند الإرجاع' : 'Product condition'}
          </label>
          <select
            value={itemCondition}
            onChange={(e) => setItemCondition(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          >
            {RETURN_ITEM_CONDITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {isAr ? c.labelAr : c.labelEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">
            {isAr ? 'هاتف للتواصل' : 'Contact phone'}
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            dir="ltr"
          />
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={isAr ? 'ملاحظة إضافية (اختياري)' : 'Additional note (optional)'}
        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            submitting
            || !reasonKey
            || (reasonKey === 'custom' && customReason.trim().length < 3)
            || maxQty < 1
          }
        >
          {isAr ? 'إرسال طلب الإرجاع' : 'Submit return request'}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
        )}
      </div>
    </form>
  );
}
