import { Plus, Trash2 } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function PaymentAccountNumbersEditor({ value = [], onChange, isAr, disabled = false }) {
  const accounts = Array.isArray(value) ? value : [];

  const updateAt = (index, field, nextValue) => {
    const next = accounts.map((entry, i) => (i === index ? { ...entry, [field]: nextValue } : entry));
    onChange(next);
  };

  const addAccount = () => {
    onChange([...accounts, { number: '', labelAr: '', labelEn: '' }]);
  };

  const removeAt = (index) => {
    onChange(accounts.filter((_, i) => i !== index));
  };

  return (
    <div className={`space-y-3 rounded-xl border border-dashed border-border bg-slate-50/70 p-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text">
            {isAr ? 'أرقام التحويل' : 'Transfer account numbers'}
          </p>
          <p className="text-xs text-text-muted">
            {isAr
              ? 'أضف كل الأرقام التي يمكن للعميل التحويل إليها'
              : 'Add every number customers can transfer money to'}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={addAccount}>
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'إضافة رقم' : 'Add number'}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          {isAr
            ? 'أضف رقماً واحداً على الأقل قبل تفعيل هذه الطريقة.'
            : 'Add at least one number before enabling this method.'}
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((entry, index) => (
            <div
              key={`account-${index}`}
              className="grid gap-3 rounded-xl border border-border bg-white p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
            >
              <Input
                label={isAr ? 'رقم التحويل' : 'Account number'}
                value={entry.number || ''}
                disabled={disabled}
                onChange={(e) => updateAt(index, 'number', e.target.value)}
                placeholder={isAr ? 'مثال: 01001234567' : 'e.g. 01001234567'}
              />
              <Input
                label={isAr ? 'تسمية (عربي)' : 'Label (Arabic)'}
                value={entry.labelAr || ''}
                disabled={disabled}
                onChange={(e) => updateAt(index, 'labelAr', e.target.value)}
                placeholder={isAr ? 'حساب رئيسي' : 'Main account'}
              />
              <Input
                label={isAr ? 'تسمية (EN)' : 'Label (English)'}
                value={entry.labelEn || ''}
                disabled={disabled}
                onChange={(e) => updateAt(index, 'labelEn', e.target.value)}
                placeholder="Main account"
              />
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  className="inline-flex h-[42px] w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 md:w-[42px]"
                  aria-label={isAr ? 'حذف الرقم' : 'Remove number'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
