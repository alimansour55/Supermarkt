import { AlertTriangle } from 'lucide-react';
import { formatAdminCategoryPath } from '../utils/adminCategoryFilter';

export default function ProductRowCategory({ product, isAr }) {
  const rawPath = isAr
    ? (product.categoryPathAr || product.categoryPathEn)
    : (product.categoryPathEn || product.categoryPathAr);
  const path = formatAdminCategoryPath(rawPath);
  const segments = path ? path.split(' > ').filter(Boolean) : [];
  const leafLabel = segments[segments.length - 1] || '';
  const hasPath = Boolean(path);
  const integrityOk = product.categoryIntegrityOk !== false;

  if (!hasPath) {
    return (
      <div className="max-w-[18rem]">
        <p className="text-xs font-medium text-red-600">
          {isAr ? 'قسم غير مكتمل' : 'Missing category'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[18rem]">
      <p className={`text-sm font-semibold leading-snug ${integrityOk ? 'text-text' : 'text-amber-900'}`}>
        {!integrityOk && (
          <AlertTriangle className="me-1 inline h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
        )}
        {leafLabel}
      </p>
      <p className={`mt-0.5 text-[11px] leading-snug ${integrityOk ? 'text-text-muted' : 'text-amber-800'}`}>
        {path}
      </p>
      {!integrityOk && (
        <p className="mt-0.5 text-[10px] font-medium text-amber-700">
          {isAr ? 'تعارض في ربط الأقسام' : 'Category link mismatch'}
        </p>
      )}
    </div>
  );
}
