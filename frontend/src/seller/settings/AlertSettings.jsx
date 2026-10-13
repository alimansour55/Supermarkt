import { useState } from 'react';
import { BellRing, Mail, MessageCircle, PackageX, Timer } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';

const OPTIONS = [
  { key: 'emailOrders', Icon: Mail, ar: 'بريد عند كل طلب جديد', en: 'Email me every new order', hintAr: 'يصل لك ولكل فريقك', hintEn: 'Sent to you and your team' },
  { key: 'whatsappOrders', Icon: MessageCircle, ar: 'رسالة واتساب للطلبات الجديدة والتذكيرات', en: 'WhatsApp for new orders and reminders', hintAr: 'على رقم هاتف المتجر', hintEn: "To your store's phone number" },
  { key: 'shipByReminders', Icon: Timer, ar: 'تذكير قبل موعد الشحن بـ 6 ساعات', en: 'Remind me 6 hours before the ship-by time', hintAr: 'لتجنب الشحن المتأخر', hintEn: 'Avoid late shipments' },
  { key: 'emailLowStock', Icon: PackageX, ar: 'بريد عند انخفاض المخزون', en: 'Email me when stock runs low', hintAr: 'حدد مستوى التنبيه لكل منتج من صفحة المخزون', hintEn: 'Set the level per product on Manage inventory' },
];

/** Which alerts the store gets by email / WhatsApp (in-app notifications are always on). */
export default function AlertSettings({ seller, isAr, reload }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState(seller.notificationPrefs || {});
  const [saving, setSaving] = useState('');

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    try {
      await sellerApi.updateProfile({ notificationPrefs: { [key]: next[key] } });
      reload();
    } catch (err) {
      setPrefs(prefs);
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setSaving('');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-bold"><BellRing className="h-5 w-5 text-indigo-600" />{isAr ? 'التنبيهات والرسائل' : 'Alerts & messages'}</h2>
        <p className="text-sm text-slate-500">{isAr ? 'إشعارات مركز البائعين تعمل دائماً. اختر ما يصلك أيضاً بالبريد أو واتساب.' : 'Seller Center notifications are always on. Choose what else reaches you by email or WhatsApp.'}</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {OPTIONS.map((o) => {
          const on = Boolean(prefs[o.key]);
          return (
            <li key={o.key} className="flex items-center gap-4 px-5 py-4">
              <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><o.Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{isAr ? o.ar : o.en}</p>
                <p className="text-xs text-slate-500">{isAr ? o.hintAr : o.hintEn}{o.key === 'whatsappOrders' && seller.phone ? ` (${seller.phone})` : ''}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={saving === o.key}
                onClick={() => toggle(o.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'start-[1.375rem]' : 'start-0.5'}`} />
                <span className="sr-only">{isAr ? o.ar : o.en}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
