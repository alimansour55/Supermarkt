import { useState } from 'react';
import { Check, RotateCcw, Pencil } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ReturnRejectForm from './ReturnRejectForm';
import { isRejectNoteValid } from '../../../constants/returnRejectReasons';

export default function ReturnRejectedEditPanel({
  isAr,
  note,
  onNoteChange,
  onSaveRejectReason,
  onApproveInstead,
  onReopen,
  onCancel,
  updating,
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleSaveReject = () => {
    if (!isRejectNoteValid(note)) {
      setShowRejectForm(true);
      return;
    }
    onSaveRejectReason();
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-red-200 bg-white p-3">
      <p className="text-sm font-bold text-text">
        {isAr ? 'تعديل قرار الرفض' : 'Edit rejection decision'}
      </p>
      <p className="text-xs text-text-muted">
        {isAr
          ? 'يمكنك تصحيح سبب الرفض، الموافقة على الإرجاع، أو إعادة الطلب للمراجعة.'
          : 'Update the rejection reason, approve the return, or send it back to pending review.'}
      </p>

      {!showRejectForm ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={updating}
            onClick={() => {
              setShowRejectForm(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            {isAr ? 'تعديل سبب الرفض' : 'Edit rejection reason'}
          </Button>
          <Button size="sm" disabled={updating} onClick={onApproveInstead}>
            <Check className="h-4 w-4" />
            {isAr ? 'الموافقة بدلاً من الرفض' : 'Approve instead'}
          </Button>
          <Button size="sm" variant="secondary" disabled={updating} onClick={onReopen}>
            <RotateCcw className="h-4 w-4" />
            {isAr ? 'إعادة للمراجعة' : 'Back to pending'}
          </Button>
          <Button size="sm" variant="ghost" disabled={updating} onClick={onCancel}>
            {isAr ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      ) : (
        <>
          <ReturnRejectForm
            isAr={isAr}
            note={note}
            onNoteChange={onNoteChange}
            updating={updating}
            onCancel={() => setShowRejectForm(false)}
            onConfirm={handleSaveReject}
            confirmLabelAr="حفظ سبب الرفض"
            confirmLabelEn="Save rejection reason"
          />
          <div className="flex flex-wrap gap-2 border-t border-border pt-2">
            <Button size="sm" disabled={updating} onClick={onApproveInstead}>
              <Check className="h-4 w-4" />
              {isAr ? 'الموافقة بدلاً من الرفض' : 'Approve instead'}
            </Button>
            <Button size="sm" variant="secondary" disabled={updating} onClick={onReopen}>
              <RotateCcw className="h-4 w-4" />
              {isAr ? 'إعادة للمراجعة' : 'Back to pending'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
