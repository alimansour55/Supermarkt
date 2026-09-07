import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import { useConfirm, useToast } from './index';

const ISSUE_LABELS = {
  missing_leaf: { en: 'Missing category', ar: 'قسم مفقود' },
  orphaned_ref: { en: 'Orphaned category ref', ar: 'مرجع قسم غير موجود' },
  fields_out_of_sync: { en: 'category ≠ subCategory', ar: 'تعارض category و subCategory' },
  wrong_main: { en: 'Wrong main category', ar: 'قسم رئيسي خاطئ' },
  non_leaf: { en: 'Not a leaf category', ar: 'ليس قسمًا فرعيًا نهائيًا' },
  inactive_category: { en: 'Inactive category', ar: 'قسم غير نشط' },
};

function issueLabel(code, isAr) {
  return ISSUE_LABELS[code]?.[isAr ? 'ar' : 'en'] || code;
}

export default function ProductCategoryIntegrityPanel({ isAr, onRepaired }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.getProductCategoryIntegrity({ sampleLimit: 30 });
      setReport(data.data);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'فشل فحص الأقسام' : 'Category scan failed'));
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const runRepair = async (dryRun) => {
    if (!dryRun) {
      const ok = await confirm({
        title: isAr ? 'إصلاح ربط الأقسام' : 'Repair category links',
        message: isAr
          ? `سيتم إصلاح ${report.repairableCount} منتج تلقائيًا. المنتجات غير القابلة للإصلاح تحتاج تعديلًا يدويًا.`
          : `This will auto-repair ${report.repairableCount} product(s). Unrepairable items need manual edits.`,
        confirmLabel: isAr ? 'إصلاح' : 'Repair',
        cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      });
      if (!ok) return;
    }

    setRepairing(true);
    setError('');
    try {
      const { data } = await adminApi.repairProductCategoryIntegrity({ dryRun });
      const result = data.data;
      if (dryRun) {
        const count = result.productsWouldFix ?? result.wouldFix ?? 0;
        toast.success(
          isAr ? `معاينة: ${count} منتج سيتم إصلاحه` : `Preview: ${count} product(s) would be fixed`,
        );
      } else {
        const count = result.productsFixed ?? result.fixed ?? 0;
        toast.success(
          isAr ? `تم إصلاح ${count} منتج` : `Repaired ${count} product(s)`,
        );
        await load();
        onRepaired?.();
      }
    } catch (err) {
      const message = err.response?.data?.message || (isAr ? 'فشل الإصلاح' : 'Repair failed');
      setError(message);
      toast.error(message);
    } finally {
      setRepairing(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isAr ? 'جاري فحص ربط الأقسام...' : 'Checking category links...'}
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
        <button type="button" className="ms-2 font-semibold underline" onClick={load}>
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!report?.issueCount) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {isAr
            ? `كل المنتجات (${report?.totalProducts ?? 0}) مربوطة بأقسام صحيحة`
            : `All ${report?.totalProducts ?? 0} products have valid category links`}
        </div>
        <button type="button" className="text-xs font-semibold text-emerald-800 underline" onClick={load}>
          {isAr ? 'إعادة الفحص' : 'Re-scan'}
        </button>
      </div>
    );
  }

  const issueEntries = Object.entries(report.byIssue || {}).filter(([, count]) => count > 0);

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {isAr
                ? `${report.issueCount} منتج بمشاكل في ربط الأقسام`
                : `${report.issueCount} product(s) with category link issues`}
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              {isAr
                ? `${report.repairableCount} قابل للإصلاح التلقائي · ${report.unrepairableCount} يحتاج تدخل يدوي`
                : `${report.repairableCount} auto-repairable · ${report.unrepairableCount} need manual fix`}
            </p>
            {issueEntries.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {issueEntries.map(([code, count]) => (
                  <li
                    key={code}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                  >
                    {issueLabel(code, isAr)}: {count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runRepair(true)}
            disabled={repairing || !report.repairableCount}
          >
            {isAr ? 'معاينة الإصلاح' : 'Preview repair'}
          </Button>
          <Button
            size="sm"
            onClick={() => runRepair(false)}
            disabled={repairing || !report.repairableCount}
          >
            <Wrench className="h-4 w-4" />
            {repairing
              ? (isAr ? 'جاري الإصلاح...' : 'Repairing...')
              : (isAr ? 'إصلاح تلقائي' : 'Auto-repair')}
          </Button>
          <button
            type="button"
            className="text-xs font-semibold text-amber-900 underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? (isAr ? 'إخفاء التفاصيل' : 'Hide details')
              : (isAr ? 'عرض عينات' : 'Show samples')}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {expanded && report.samples?.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200/80 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-amber-100 bg-amber-50/50 text-amber-950">
              <tr>
                <th className="px-3 py-2 font-semibold">{isAr ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2 font-semibold">{isAr ? 'المسار' : 'Path'}</th>
                <th className="px-3 py-2 font-semibold">{isAr ? 'المشاكل' : 'Issues'}</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {report.samples.map((row) => (
                <tr key={row.productId} className="border-b border-amber-50 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-text">{isAr ? row.nameAr : row.nameEn}</p>
                    <p className="text-text-muted">{row.slug}</p>
                  </td>
                  <td className="max-w-[14rem] px-3 py-2 text-text-muted">
                    {isAr ? (row.categoryPathAr || '—') : (row.categoryPathEn || '—')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.issues.map((issue) => (
                        <span
                          key={issue.code}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                        >
                          {issueLabel(issue.code, isAr)}
                        </span>
                      ))}
                    </div>
                    {!row.repairable && (
                      <p className="mt-1 text-[10px] font-medium text-red-600">
                        {isAr ? 'يتطلب تعديل يدوي' : 'Manual edit required'}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/admin/products/${row.productId}/edit`}
                      className="font-semibold text-orange-700 hover:underline"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
