import { useEffect, useState } from 'react';
import { ListFilterSelect } from './list';
import Input from '../../components/ui/Input';
import { DEFAULT_STOCK_THRESHOLD, writeStockThreshold } from '../utils/stockThreshold';

export default function ProductStockFilter({
  isAr,
  stock,
  stockMax,
  onStockChange,
  onStockMaxChange,
  onThresholdCommit,
  showBelowOption = false,
  thresholdLabel,
  thresholdHint,
  savingThreshold = false,
}) {
  const [thresholdInput, setThresholdInput] = useState(
    () => String(stockMax ?? DEFAULT_STOCK_THRESHOLD),
  );

  useEffect(() => {
    if (stockMax !== undefined && stockMax !== '') {
      setThresholdInput(String(stockMax));
    }
  }, [stockMax]);

  const commitThreshold = async (raw) => {
    const normalized = writeStockThreshold(raw);
    setThresholdInput(String(normalized));
    onStockMaxChange?.(String(normalized));
    if (onThresholdCommit) {
      await onThresholdCommit(normalized);
    }
  };

  const resolvedThreshold = thresholdInput || String(DEFAULT_STOCK_THRESHOLD);

  const options = [
    { value: '', label: isAr ? 'كل المخزون' : 'All stock' },
    ...(showBelowOption
      ? [{
        value: 'below',
        label: isAr
          ? `تنبيهات (≤ ${resolvedThreshold})`
          : `Alerts (≤ ${resolvedThreshold})`,
      }]
      : []),
    { value: 'out', label: isAr ? 'نفد (0)' : 'Out of stock (0)' },
    {
      value: 'low',
      label: isAr
        ? `منخفض (1–${resolvedThreshold})`
        : `Low (1–${resolvedThreshold})`,
    },
    {
      value: 'in',
      label: isAr
        ? `متوفر (>${resolvedThreshold})`
        : `In stock (>${resolvedThreshold})`,
    },
  ];

  const label = thresholdLabel ?? (isAr ? 'حد التنبيه' : 'Alert threshold');
  const hint = thresholdHint ?? (
    isAr
      ? 'يُظهر المنتجات التي مخزونها ≤ هذا الرقم في تنبيهات «يحتاج تجديد»'
      : 'Products with stock ≤ this number appear under “Needs restock” alerts'
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <ListFilterSelect
        label={isAr ? 'المخزون' : 'Stock'}
        value={stock}
        onChange={onStockChange}
        options={options}
        showLabel
      />
      <div className="flex min-w-[9rem] flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
          {label}
        </span>
        <Input
          type="number"
          min={0}
          step={1}
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          onBlur={() => commitThreshold(thresholdInput)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitThreshold(thresholdInput);
          }}
          className="w-28 py-2 text-sm"
          aria-label={label}
          disabled={savingThreshold}
        />
        {hint && (
          <span className="max-w-[14rem] text-[10px] leading-snug text-text-muted">{hint}</span>
        )}
      </div>
    </div>
  );
}
