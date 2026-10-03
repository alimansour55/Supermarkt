import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';

function formatDateTime(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ProductFormStickyBar({
  isAr,
  isEdit,
  saving,
  onSave,
  onSaveAndAddAnother,
  onCancel,
  updatedAt,
  stockUpdatedAt,
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-text-muted">
          {isEdit && updatedAt && (
            <p className="truncate">
              {isAr ? 'آخر تحديث:' : 'Last updated:'}{' '}
              <span className="font-medium text-text">{formatDateTime(updatedAt, isAr)}</span>
              {stockUpdatedAt && (
                <>
                  {' · '}
                  {isAr ? 'آخر تغيير للمخزون:' : 'Stock changed:'}{' '}
                  <span className="font-medium text-text">{formatDateTime(stockUpdatedAt, isAr)}</span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          {!isEdit && (
            <Button type="button" variant="secondary" disabled={saving} onClick={onSaveAndAddAnother}>
              {isAr ? 'حفظ وإضافة آخر' : 'Save & add another'}
            </Button>
          )}
          <Button type="button" disabled={saving} onClick={onSave}>
            {saving ? <Loader size="sm" /> : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
