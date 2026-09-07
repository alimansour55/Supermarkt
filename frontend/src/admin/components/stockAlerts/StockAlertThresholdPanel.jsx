import { useEffect, useState } from 'react';
import { Bell, Check, Minus, Plus, Settings2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { DEFAULT_STOCK_THRESHOLD, writeStockThreshold } from '../../utils/stockThreshold';

const PRESETS = [3, 5, 10, 15, 20, 25, 50];

export default function StockAlertThresholdPanel({
  isAr,
  value,
  saving,
  onSave,
}) {
  const [input, setInput] = useState(String(value ?? DEFAULT_STOCK_THRESHOLD));
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setInput(String(value ?? DEFAULT_STOCK_THRESHOLD));
    setDirty(false);
  }, [value]);

  useEffect(() => {
    if (!justSaved) return undefined;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);

  const normalized = Math.max(0, Math.floor(Number(input) || 0));

  const apply = async (next) => {
    const n = writeStockThreshold(next);
    setInput(String(n));
    setDirty(false);
    await onSave(n);
    setJustSaved(true);
  };

  const bump = (delta) => {
    const next = Math.max(0, normalized + delta);
    setInput(String(next));
    setDirty(next !== value);
  };

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
          <Settings2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-bold text-text">
            {isAr ? 'إعدادات التنبيه' : 'Alert settings'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {isAr
              ? 'يُحدّث القائمة تلقائياً بعد الحفظ — تظهر كل المنتجات التي مخزونها ≤ هذا الرقم (مع النافد).'
              : 'The list updates automatically after save — shows every product with stock ≤ this number (including out of stock).'}
          </p>
        </div>
      </div>

      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {isAr ? 'تنبيه عندما يكون المخزون ≤' : 'Alert when stock is ≤'}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={saving || normalized <= 0}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted/40 text-text transition hover:border-orange-200 disabled:opacity-40"
          aria-label={isAr ? 'تقليل' : 'Decrease'}
        >
          <Minus className="h-4 w-4" />
        </button>
        <Input
          type="number"
          min={0}
          step={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(input);
          }}
          className="h-10 flex-1 text-center text-lg font-bold"
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          disabled={saving}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted/40 text-text transition hover:border-orange-200 disabled:opacity-40"
          aria-label={isAr ? 'زيادة' : 'Increase'}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => apply(preset)}
            disabled={saving}
            className={[
              'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
              value === preset
                ? 'border-orange-300 bg-orange-50 text-orange-800'
                : 'border-border bg-white text-text-muted hover:border-orange-200 hover:text-text',
            ].join(' ')}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => apply(input)}
          disabled={saving || (!dirty && !justSaved)}
          className="flex-1"
        >
          {saving
            ? (isAr ? 'جاري الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ الحد' : 'Save threshold')}
        </Button>
        {justSaved && !saving && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            {isAr ? 'تم' : 'Saved'}
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-2 border-t border-border pt-4 text-[11px] leading-relaxed text-text-muted">
        <li className="flex gap-2">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          {isAr ? '«نفد» = مخزون 0 (لا يُباع على الموقع)' : 'Out of stock = 0 units (unavailable on storefront)'}
        </li>
        <li className="flex gap-2">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          {isAr
            ? `القائمة الافتراضية = كل ما ≤ ${value ?? '—'} (0 = نفد + منخفض)`
            : `Default list = everything ≤ ${value ?? '—'} (0 = out + low)`}
        </li>
        <li className="flex gap-2">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          {isAr
            ? `«منخفض» = مخزون من 1 إلى ${value ?? '—'} (لا يزال متاحاً)`
            : `Low = stock 1–${value ?? '—'} (still available)`}
        </li>
      </ul>
    </section>
  );
}
