import Button from '../../../components/ui/Button';

export default function BulkActionsBar({
  count,
  isAr,
  onActivate,
  onDeactivate,
  onDelete,
  showActivate = true,
  onClear,
}) {
  if (!count) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-primary-100 bg-primary-50 px-4 py-3">
      <span className="text-sm font-medium text-primary-800">
        {isAr ? `${count} محدد` : `${count} selected`}
      </span>
      {showActivate && onActivate && (
        <Button size="sm" variant="secondary" onClick={onActivate}>
          {isAr ? 'تفعيل' : 'Activate'}
        </Button>
      )}
      {showActivate && onDeactivate && (
        <Button size="sm" variant="secondary" onClick={onDeactivate}>
          {isAr ? 'تعطيل' : 'Deactivate'}
        </Button>
      )}
      {onDelete && (
        <Button size="sm" variant="danger" onClick={onDelete}>
          {isAr ? 'حذف' : 'Delete'}
        </Button>
      )}
      <button type="button" className="text-sm text-text-muted hover:text-text" onClick={onClear}>
        {isAr ? 'إلغاء التحديد' : 'Clear'}
      </button>
    </div>
  );
}
