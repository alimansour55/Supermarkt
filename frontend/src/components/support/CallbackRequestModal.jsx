import { useState } from 'react';
import { CheckCircle2, PhoneOutgoing, X } from 'lucide-react';
import { createCallbackRequest } from '../../services/supportApi';

export default function CallbackRequestModal({
  isAr,
  user,
  note: settingsNote,
  source = 'contact_page',
  onClose,
}) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(isAr ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    if (!/^[\d+\s()-]{6,20}$/.test(phone.trim())) {
      setError(isAr ? 'أدخل رقم هاتف صحيح' : 'Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    try {
      await createCallbackRequest({ name: name.trim(), phone: phone.trim(), note: note.trim(), source });
      setDone(true);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر إرسال الطلب' : 'Could not send the request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'اطلب أن نتصل بك' : 'Request a call back'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <PhoneOutgoing className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold text-text">{isAr ? 'اطلب أن نتصل بك' : 'Request a call back'}</h2>
              {settingsNote && <p className="mt-0.5 text-xs text-text-muted">{settingsNote}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-slate-100 hover:text-text"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </span>
            <p className="font-semibold text-text">
              {isAr ? 'تم استلام طلبك' : 'Your request was received'}
            </p>
            <p className="text-sm text-text-muted">
              {settingsNote || (isAr ? 'هنتصل بيك في أقرب وقت ممكن' : "We'll call you back as soon as possible")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700"
            >
              {isAr ? 'تمام' : 'Got it'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted">
                {isAr ? 'الاسم' : 'Name'} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted">
                {isAr ? 'رقم الهاتف' : 'Phone number'} *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted">
                {isAr ? 'ملاحظة (اختياري)' : 'Note (optional)'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? (isAr ? 'جارِ الإرسال...' : 'Sending...') : (isAr ? 'إرسال الطلب' : 'Send request')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
