import { Bot, ClipboardList, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function CheckoutChoiceModal({ source, onAi, onManual, onClose }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const onCheckoutPage = source === 'checkout';

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label={isAr ? 'إغلاق' : 'Close'}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-choice-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-600 to-primary-800 px-5 py-4 text-white">
          <div className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-100">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                {isAr ? 'إتمام الطلب' : 'Complete order'}
              </p>
              <h2 id="checkout-choice-title" className="mt-1 text-lg font-bold">
                {isAr ? 'كيف تفضل إتمام طلبك؟' : 'How would you like to checkout?'}
              </h2>
              <p className="mt-1 text-sm text-primary-100">
                {onCheckoutPage
                  ? (isAr ? 'اختر المساعد الذكي أو أكمل في هذه الصفحة' : 'Use the AI assistant or continue on this page')
                  : (isAr ? 'المساعد الذكي يمكنه إتمام الطلب نيابةً عنك' : 'The AI assistant can place the order for you')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <button
            type="button"
            onClick={onAi}
            className="group flex w-full items-start gap-4 rounded-2xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4 text-start transition hover:border-primary-400 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-600/25">
              <Bot className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">
                  {isAr ? 'أكمل مع المساعد الذكي' : 'Complete with AI assistant'}
                </span>
                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {isAr ? 'موصى به' : 'Recommended'}
                </span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                {isAr
                  ? 'يؤكد عنوانك المحفوظ وطريقة الدفع ويُتمّ الطلب خلال ثوانٍ'
                  : 'Confirms your saved address & payment and places the order in seconds'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onManual}
            className="group flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-start transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <ClipboardList className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-base font-bold text-slate-900">
                {onCheckoutPage
                  ? (isAr ? 'أكمل في صفحة الدفع' : 'Continue on checkout page')
                  : (isAr ? 'الانتقال لصفحة الدفع' : 'Go to checkout page')}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                {isAr
                  ? 'أدخل العنوان والموعد والدفع يدوياً بكل التفاصيل'
                  : 'Enter address, delivery slot, and payment details manually'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
