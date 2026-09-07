import { AlertTriangle, CheckCircle2, Package, XCircle } from 'lucide-react';
import AdminSlidePanel from './AdminSlidePanel';
import Button from '../../components/ui/Button';
import {
  bulkBlockReasonLabel,
  categoryLabel,
  categoryRoleMeta,
} from '../../utils/categoryHelpers';

function ImpactSection({ title, children, tone = 'default' }) {
  const tones = {
    default: 'border-border bg-slate-50',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone] || tones.default}`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">{title}</p>
      {children}
    </div>
  );
}

function CategoryImpactRow({ row, isAr, showProducts }) {
  const { category, reason } = row;
  const name = categoryLabel(category, isAr);
  const { isLeaf } = categoryRoleMeta(category);
  const active = category.activeProductCount ?? 0;
  const children = category.childCount ?? 0;

  return (
    <li className="flex items-start justify-between gap-2 border-b border-black/5 py-2 text-sm last:border-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{name}</p>
        {reason && (
          <p className="mt-0.5 text-xs text-text-muted">{bulkBlockReasonLabel(reason, isAr)}</p>
        )}
      </div>
      {showProducts && (
        <div className="shrink-0 text-end text-[11px] text-text-muted">
          {active > 0 && (
            <span className="flex items-center justify-end gap-1 text-amber-800">
              <Package className="h-3 w-3" />
              {active}
            </span>
          )}
          {!isLeaf && children > 0 && (
            <span className="block text-amber-700">
              {isAr ? `${children} فرعي` : `${children} child`}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default function CategoryBulkImpactPanel({
  open,
  onClose,
  impact,
  isAr,
  onConfirm,
  onReassign,
  applying = false,
}) {
  if (!impact) return null;

  const {
    action,
    actionTitle,
    eligible,
    skipped,
    blocked,
    canProceed,
    summaryLines,
    totals,
  } = impact;

  const firstProductBlock = blocked.find((row) => row.reason === 'active_products');

  const confirmLabel = canProceed
    ? (isAr
      ? `${actionTitle} (${eligible.length})`
      : `${actionTitle} (${eligible.length})`)
    : (isAr ? 'لا يمكن المتابعة' : 'Cannot proceed');

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      isAr={isAr}
      title={isAr ? `معاينة ${actionTitle}` : `Review ${actionTitle}`}
      subtitle={
        isAr
          ? 'تحقق من تأثير العملية على المنتجات والأقسام الفرعية'
          : 'Check impact on products and subcategories before confirming'
      }
      width="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <ul className="space-y-1">
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        {totals.activeProducts > 0 && (action === 'delete' || action === 'deactivate') && (
          <ImpactSection
            title={isAr ? 'تأثير المنتجات' : 'Product impact'}
            tone="warning"
          >
            <p className="text-sm text-amber-950">
              {isAr
                ? `${totals.activeProducts} منتج نشط مرتبط بالأقسام المحددة. لا يمكن ${action === 'delete' ? 'الحذف' : 'التعطيل'} حتى تنقل المنتجات.`
                : `${totals.activeProducts} active product(s) are linked. ${action === 'delete' ? 'Delete' : 'Deactivate'} is blocked until products are moved.`}
            </p>
          </ImpactSection>
        )}

        {eligible.length > 0 && (
          <ImpactSection title={isAr ? 'سيتم التطبيق' : 'Will apply'} tone="success">
            <ul className="max-h-40 overflow-y-auto">
              {eligible.map((category) => (
                <CategoryImpactRow
                  key={category._id}
                  row={{ category }}
                  isAr={isAr}
                  showProducts={action !== 'activate'}
                />
              ))}
            </ul>
          </ImpactSection>
        )}

        {skipped.length > 0 && (
          <ImpactSection title={isAr ? 'سيُتخطى' : 'Will skip'} tone="default">
            <ul className="max-h-32 overflow-y-auto">
              {skipped.map((row) => (
                <CategoryImpactRow key={row.category._id} row={row} isAr={isAr} showProducts={false} />
              ))}
            </ul>
          </ImpactSection>
        )}

        {blocked.length > 0 && (
          <ImpactSection title={isAr ? 'محظور' : 'Blocked'} tone="danger">
            <ul className="max-h-40 overflow-y-auto">
              {blocked.map((row) => (
                <CategoryImpactRow key={row.category._id} row={row} isAr={isAr} showProducts />
              ))}
            </ul>
          </ImpactSection>
        )}

        {canProceed && blocked.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {isAr ? 'لا توجد قيود — آمن للمتابعة' : 'No blockers — safe to proceed'}
          </div>
        )}

        {!canProceed && (
          <div className="flex items-center gap-2 text-sm text-red-800">
            <XCircle className="h-4 w-4" />
            {isAr
              ? 'لا يمكن تنفيذ العملية على أي قسم من المحدد.'
              : 'This action cannot be applied to any selected category.'}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            onClick={() => onConfirm(impact.eligibleIds)}
            disabled={!canProceed || applying}
            variant={action === 'delete' ? 'danger' : 'primary'}
          >
            {applying ? (isAr ? 'جاري التطبيق…' : 'Applying…') : confirmLabel}
          </Button>
          {firstProductBlock && onReassign && (
            <Button
              variant="secondary"
              onClick={() => onReassign(firstProductBlock.category)}
              disabled={applying}
            >
              {isAr ? 'نقل المنتجات' : 'Move products'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </AdminSlidePanel>
  );
}
