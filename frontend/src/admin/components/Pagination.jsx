import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  isAr,
  className = '',
}) {
  if (!total) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm shadow-sm',
        className,
      ].join(' ')}
    >
      <p className="text-text-muted">
        {isAr
          ? `عرض ${start}–${end} من ${total}`
          : `Showing ${start}–${end} of ${total}`}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-[4rem] text-center font-medium text-text">
            {isAr ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
