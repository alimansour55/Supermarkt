import { getOrderStatus } from '../adminConstants';

export default function StatusBadge({ status, language = 'ar' }) {
  const info = getOrderStatus(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${info.color}`}>
      {language === 'ar' ? info.labelAr : info.labelEn}
    </span>
  );
}
