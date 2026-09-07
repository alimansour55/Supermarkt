import { useEffect, useState } from 'react';
import { Check, Loader2, Minus, Plus } from 'lucide-react';
import { adminApi } from '../../adminApi';

/**
 * Inline stock editor for a single product row. Lets admins restock without
 * leaving the alerts list — saves via PUT /products/admin/:id { stock }.
 */
export default function QuickRestockInput({ product, isAr, onSaved, onError }) {
  const [value, setValue] = useState(String(product.stock ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saving) setValue(String(product.stock ?? 0));
  }, [product.stock, saving]);

  const currentStock = Number(product.stock) || 0;
  const parsed = Math.max(0, Math.floor(Number(value) || 0));
  const dirty = value !== '' && parsed !== currentStock;

  const commit = async (next) => {
    const n = Math.max(0, Math.floor(Number(next) || 0));
    if (n === currentStock) return;
    setSaving(true);
    try {
      await adminApi.updateProduct(product._id, { stock: n });
      onSaved?.(n);
    } catch (err) {
      setValue(String(currentStock));
      onError?.(err);
    } finally {
      setSaving(false);
    }
  };

  const bump = (delta) => {
    const next = Math.max(0, parsed + delta);
    setValue(String(next));
    commit(next);
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={saving || parsed <= 0}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted/40 text-text transition hover:border-orange-200 disabled:opacity-40"
        aria-label={isAr ? 'تقليل المخزون' : 'Decrease stock'}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={0}
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); commit(value); }
        }}
        onBlur={() => { if (dirty) commit(value); }}
        className="h-7 w-14 rounded-lg border border-border bg-white text-center text-sm font-semibold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
        aria-label={isAr ? 'كمية المخزون' : 'Stock quantity'}
      />
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={saving}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted/40 text-text transition hover:border-orange-200 disabled:opacity-40"
        aria-label={isAr ? 'زيادة المخزون' : 'Increase stock'}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />}
        {!saving && dirty && <Check className="h-3.5 w-3.5 text-emerald-600" />}
      </span>
    </div>
  );
}
