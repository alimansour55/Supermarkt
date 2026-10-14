import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle2, Clock, MessageCircle, Navigation, Package, Phone, RotateCcw, Truck, X, XCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import {
  formatDriverAddress, itemName, mapsDirectionsUrl, whatsappUrl,
} from './driverUtils';

const CONDITIONS = [
  { key: 'unopened', ar: 'مغلق / غير مفتوح', en: 'Unopened / sealed' },
  { key: 'opened', ar: 'مفتوح بحالة جيدة', en: 'Opened, good condition' },
  { key: 'damaged', ar: 'تالف', en: 'Damaged' },
];

const conditionLabel = (key, isAr) => {
  const row = CONDITIONS.find((c) => c.key === key);
  return row ? (isAr ? row.ar : row.en) : key;
};

/** Collect a customer's return from their door. */
export default function DriverPickupPage() {
  const { orderId, returnId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [task, setTask] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [mode, setMode] = useState(null); // 'collected' | 'not_collected'
  const [condition, setCondition] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await orderService.getDriverPickup(orderId, returnId);
      setTask(data.data);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message);
    }
  }, [orderId, returnId]);

  useEffect(() => { load(); }, [load]);

  const run = async (request) => {
    setBusy(true);
    setActionError('');
    try {
      const { data } = await request();
      setTask(data.data);
      return true;
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = (file) => {
    if (!file) return;
    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const submit = async () => {
    const ok = await run(() => orderService.finishDriverPickup(
      orderId,
      returnId,
      { outcome: mode, condition: mode === 'collected' ? condition : undefined, note: note.trim() },
      mode === 'collected' ? photo : null,
    ));
    if (ok) setMode(null);
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to="/driver" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700">
          <ArrowLeft className="h-4 w-4" />
          {isAr ? 'كل الطلبات' : 'All deliveries'}
        </Link>
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      </div>
    );
  }
  if (!task) {
    return <div className="flex justify-center py-20"><Loader size="lg" /></div>;
  }

  const addr = task.shippingAddress;
  const open = ['confirmed', 'pickup_en_route'].includes(task.fulfillmentStatus) && task.pickupOutcome !== 'not_collected';
  const enRoute = task.fulfillmentStatus === 'pickup_en_route';
  const done = task.fulfillmentStatus === 'completed';
  const slot = isAr ? task.pickupSlotLabelAr || task.pickupSlotLabelEn : task.pickupSlotLabelEn || task.pickupSlotLabelAr;
  const canSubmit = mode === 'collected' ? Boolean(condition) : note.trim().length >= 3;

  return (
    <div className="space-y-4 pb-4">
      <Link to="/driver" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {isAr ? 'كل الطلبات' : 'All deliveries'}
      </Link>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-4 py-4 text-white">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'استلام مرتجع' : 'Return pickup'}
          </p>
          <h1 className="mt-2 font-mono text-3xl font-bold tabular-nums">#{task.orderNumber}</h1>
          {task.customerName && <p className="mt-1 text-sm text-slate-200">{task.customerName}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {slot && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/10">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {task.pickupDate ? `${new Date(task.pickupDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ` : ''}
                {slot}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4">
          {task.item.image ? (
            <img src={task.item.image} alt="" className="h-14 w-14 rounded-xl border border-slate-100 object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Package className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{itemName(task.item, isAr)}</p>
            <p className="text-xs text-slate-500">× {task.item.quantity}</p>
            <p className="mt-1 text-xs text-slate-600">
              {isAr ? 'حالة المنتج حسب العميل: ' : 'Customer says: '}
              <span className="font-semibold">{conditionLabel(task.customerCondition, isAr)}</span>
            </p>
          </div>
        </div>
        {(task.reasonAr || task.reasonEn || task.customerNote) && (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            {(isAr ? task.reasonAr || task.reasonEn : task.reasonEn || task.reasonAr)}
            {task.customerNote && <p className="mt-1 text-xs text-slate-500">“{task.customerNote}”</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <p className="text-sm leading-relaxed text-slate-600">{formatDriverAddress(addr, isAr)}</p>
        <a
          href={mapsDirectionsUrl(addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          <Navigation className="h-4 w-4" aria-hidden />
          {isAr ? 'ملاحة — Google Maps' : 'Navigate — Google Maps'}
        </a>
        {task.phone && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`tel:${task.phone}`} className="flex items-center justify-center gap-2 rounded-xl border-2 border-teal-200 bg-teal-50 py-3 text-sm font-semibold text-teal-800">
              <Phone className="h-4 w-4" aria-hidden />
              {isAr ? 'اتصال' : 'Call'}
            </a>
            <a href={whatsappUrl(task.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800">
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          </div>
        )}
      </section>

      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{actionError}</p>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" aria-hidden />
          <p className="font-semibold text-emerald-900">{isAr ? 'تم استلام المرتجع' : 'Return collected'}</p>
          <p className="mt-1 text-sm text-emerald-800">
            {isAr ? 'سلّم المنتج للفرع.' : 'Hand the item in at the store.'}
            {' '}
            {conditionLabel(task.pickupCondition, isAr)}
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/driver')}>
            {isAr ? 'العودة للطلبات' : 'Back to deliveries'}
          </Button>
        </div>
      )}

      {task.pickupOutcome === 'not_collected' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <XCircle className="mx-auto mb-2 h-10 w-10 text-red-600" aria-hidden />
          <p className="font-semibold text-red-900">{isAr ? 'تم تسجيل عدم الاستلام' : 'Marked as not collected'}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate('/driver')}>
            {isAr ? 'العودة للطلبات' : 'Back to deliveries'}
          </Button>
        </div>
      )}

      {open && !mode && (
        <div className="sticky bottom-20 z-20 -mx-4 space-y-2 rounded-t-2xl border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
          {!enRoute && (
            <Button type="button" className="w-full bg-violet-600 py-3 hover:bg-violet-700" disabled={busy} onClick={() => run(() => orderService.startDriverPickup(orderId, returnId))}>
              <Truck className="h-5 w-5" aria-hidden />
              {isAr ? 'أنا في الطريق للعميل' : "I'm on my way"}
            </Button>
          )}
          <Button type="button" className="w-full bg-emerald-600 py-3 hover:bg-emerald-700" disabled={busy} onClick={() => setMode('collected')}>
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {isAr ? 'تم استلام المنتج' : 'Item collected'}
          </Button>
          <Button type="button" variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50" disabled={busy} onClick={() => setMode('not_collected')}>
            <XCircle className="h-4 w-4" aria-hidden />
            {isAr ? 'تعذّر الاستلام' : 'Could not collect'}
          </Button>
        </div>
      )}

      {mode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true">
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'collected' ? (isAr ? 'تأكيد استلام المرتجع' : 'Confirm return collected') : (isAr ? 'لماذا تعذّر الاستلام؟' : 'Why could you not collect it?')}
            </h2>

            {mode === 'collected' && (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isAr ? 'حالة المنتج عند الاستلام' : 'Item condition at pickup'}</p>
                  {CONDITIONS.map((c) => (
                    <label key={c.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${condition === c.key ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                      <input type="radio" name="condition" checked={condition === c.key} onChange={() => setCondition(c.key)} />
                      {isAr ? c.ar : c.en}
                    </label>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{isAr ? 'صورة (اختياري)' : 'Photo (optional)'}</p>
                  {photoPreview ? (
                    <div className="relative overflow-hidden rounded-xl border border-slate-200">
                      <img src={photoPreview} alt="" className="h-36 w-full object-cover" />
                      <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(''); }} className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white" aria-label={isAr ? 'إزالة الصورة' : 'Remove photo'}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-5 text-sm text-slate-500">
                      <Camera className="h-6 w-6" aria-hidden />
                      {isAr ? 'صوّر المنتج' : 'Photograph the item'}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </div>
              </>
            )}

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'collected'
                ? (isAr ? 'ملاحظة (اختياري)' : 'Note (optional)')
                : (isAr ? 'مثال: العميل غير موجود' : 'e.g. customer not home')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
            />

            {actionError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setMode(null); setActionError(''); }} disabled={busy}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="button"
                className={`flex-1 ${mode === 'collected' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                disabled={busy || !canSubmit}
                onClick={submit}
              >
                {busy ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'تأكيد' : 'Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
