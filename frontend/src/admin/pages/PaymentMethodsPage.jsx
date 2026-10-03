import { useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, Eye, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader } from '../components';
import PaymentMethodEditorCard from '../components/PaymentMethodEditorCard';
import { useStoreSettingsForm } from '../hooks/useStoreSettingsForm';
import { requiresAccountNumbers } from '../../constants/paymentMethods';

function sortMethods(methods) {
  return [...methods].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function CheckoutPreview({ methods, isAr }) {
  // What customers actually see: enabled, and (for gateways) configured on the server.
  const enabled = sortMethods(methods)
    .filter((method) => method.enabled !== false && method.gatewayConfigured !== false);

  if (!enabled.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-8 text-center">
        <AlertTriangle className="mb-2 h-8 w-8 text-amber-600" aria-hidden />
        <p className="text-sm font-semibold text-amber-900">
          {isAr ? 'لا توجد طرق دفع مفعّلة' : 'No payment methods enabled'}
        </p>
        <p className="mt-1 text-xs text-amber-800/80">
          {isAr ? 'فعّل طريقة واحدة على الأقل لإكمال الدفع' : 'Enable at least one method for checkout'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {enabled.map((method, index) => (
        <div
          key={method.id}
          className={[
            'rounded-xl border p-3.5 transition-all',
            index === 0
              ? 'border-primary-500 bg-primary-50/80 ring-2 ring-primary-500/20'
              : 'border-slate-200 bg-slate-50/50',
          ].join(' ')}
        >
          <div className="flex items-start gap-3">
            <span
              className={[
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                index === 0 ? 'border-primary-600' : 'border-slate-300',
              ].join(' ')}
            >
              {index === 0 && <span className="h-2 w-2 rounded-full bg-primary-600" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">
                {isAr ? method.labelAr : method.labelEn}
              </p>
              {(method.descriptionAr || method.descriptionEn) && (
                <p className="mt-0.5 text-xs text-text-muted">
                  {isAr ? method.descriptionAr : method.descriptionEn}
                </p>
              )}
              {requiresAccountNumbers(method.id) && method.accountNumbers?.length > 0 && (
                <p className="mt-1 text-[11px] font-medium text-orange-700">
                  {method.accountNumbers.length} {isAr ? 'أرقام تحويل' : 'transfer numbers'}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PaymentMethodsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings, loading, saving, save, update } = useStoreSettingsForm();
  const [expandedId, setExpandedId] = useState(null);

  const methods = useMemo(
    () => sortMethods(settings?.paymentMethods || []),
    [settings?.paymentMethods],
  );

  const enabledCount = methods.filter((method) => method.enabled !== false).length;
  const misconfiguredManual = methods.filter(
    (method) => method.enabled !== false && requiresAccountNumbers(method.id) && !(method.accountNumbers?.length),
  );

  const updateMethods = (next) => update('paymentMethods', next);

  const updateMethodAt = (index, field, value) => {
    const next = [...methods];
    next[index] = { ...next[index], [field]: value };
    updateMethods(next);
  };

  const moveMethod = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= methods.length) return;
    const next = [...methods];
    [next[index], next[target]] = [next[target], next[index]];
    updateMethods(next.map((method, sortIndex) => ({ ...method, sortOrder: sortIndex })));
  };

  if (loading || !settings) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        action={(
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="space-y-4 xl:col-span-3">
          <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <CreditCard className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">{isAr ? 'طرق الدفع' : 'Payment methods'}</h2>
                  <p className="text-sm text-text-muted">
                    {isAr
                      ? 'فعّل ورتّب طرق الدفع كما تظهر في صفحة الدفع'
                      : 'Enable, reorder, and label checkout payment options'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {methods.length} {isAr ? 'طرق' : 'methods'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enabledCount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {enabledCount} {isAr ? 'مفعّلة' : 'active'}
                </span>
              </div>
            </div>

            {misconfiguredManual.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {isAr
                    ? `أضف أرقام تحويل لـ ${misconfiguredManual.map((method) => method.labelAr || method.id).join(' و ')} قبل تفعيلها للعملاء.`
                    : `Add transfer numbers for ${misconfiguredManual.map((method) => method.labelEn || method.id).join(' and ')} before customers can use them.`}
                </p>
              </div>
            )}

            {enabledCount === 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {isAr
                    ? 'يجب تفعيل طريقة دفع واحدة على الأقل حتى يتمكن العملاء من إتمام الطلب.'
                    : 'At least one payment method must be enabled for customers to complete checkout.'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {methods.map((method, index) => (
                <PaymentMethodEditorCard
                  key={method.id || index}
                  method={method}
                  index={index}
                  total={methods.length}
                  isAr={isAr}
                  expanded={expandedId === method.id}
                  onToggleExpand={() => setExpandedId((current) => (current === method.id ? null : method.id))}
                  onUpdate={(field, value) => updateMethodAt(index, field, value)}
                  onMoveUp={() => moveMethod(index, -1)}
                  onMoveDown={() => moveMethod(index, 1)}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="xl:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Eye className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-bold">{isAr ? 'معاينة صفحة الدفع' : 'Checkout preview'}</h3>
                <p className="text-xs text-text-muted">
                  {isAr ? 'كما يراها العميل' : 'How customers will see it'}
                </p>
              </div>
            </div>

            <CheckoutPreview methods={methods} isAr={isAr} />

            <p className="mt-4 text-xs leading-relaxed text-text-muted">
              {isAr
                ? 'الترتيب من الأعلى إلى الأسفل. الطريقة الأولى المفعّلة تُحدَّد تلقائياً عند فتح صفحة الدفع.'
                : 'Order is top to bottom. The first enabled method is pre-selected at checkout.'}
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
