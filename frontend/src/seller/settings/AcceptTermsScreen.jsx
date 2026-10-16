import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';

/**
 * Shown to the store owner instead of Seller Center pages when the marketplace published a new
 * version of the seller terms. Staff logins only see a notice (the owner decides).
 */
export default function AcceptTermsScreen({ marketplace, isAr, onDone }) {
  const toast = useToast();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const text = isAr ? marketplace.termsAr || marketplace.termsEn : marketplace.termsEn || marketplace.termsAr;

  const accept = async () => {
    setBusy(true);
    try {
      await sellerApi.acceptTerms();
      toast.success(isAr ? 'شكراً — تم تسجيل موافقتك' : 'Thanks — your acceptance is recorded');
      onDone();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><ScrollText className="h-5 w-5" /></span>
      <h1 className="text-xl font-bold">{isAr ? 'تم تحديث شروط البيع' : 'The seller terms were updated'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isAr ? `اقرأ الإصدار ${marketplace.termsVersion} ووافق عليه لمتابعة استخدام مركز البائعين.` : `Read version ${marketplace.termsVersion} and accept it to keep using Seller Center.`}
      </p>
      <div className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed" dir="auto">{text}</div>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        {isAr ? 'قرأت الشروط وأوافق عليها نيابة عن المتجر.' : 'I have read the terms and accept them for the store.'}
      </label>
      <button type="button" disabled={!agree || busy} onClick={accept} className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'موافقة ومتابعة' : 'Accept and continue')}
      </button>
    </div>
  );
}
