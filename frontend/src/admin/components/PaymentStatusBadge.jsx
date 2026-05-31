import { getPaymentStatus } from '../adminConstants';

export default function PaymentStatusBadge({ status, language = 'ar' }) {
  const info = getPaymentStatus(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
      {language === 'ar' ? info.labelAr : info.labelEn}
    </span>
  );
}
