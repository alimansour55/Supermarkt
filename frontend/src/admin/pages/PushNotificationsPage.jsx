import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Send, Smartphone } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';
import { PageHeader, useConfirm, useToast } from '../components';

const EMPTY = { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', link: '/offers', imageUrl: '' };

/** Marketing push to every app user (both languages, via FCM topics). */
export default function PushNotificationsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getPushStats();
      setStats(data.data);
    } catch {
      toast.error(isAr ? 'تعذر تحميل إحصائيات الإشعارات' : 'Failed to load push stats');
    }
  }, [isAr, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const valid = (form.titleAr || form.titleEn) && (form.bodyAr || form.bodyEn)
    && (!form.link || form.link.startsWith('/'));

  const send = async () => {
    const ok = await confirm({
      title: isAr ? 'إرسال لكل المستخدمين؟' : 'Send to every user?',
      message: isAr
        ? 'سيصل هذا الإشعار لكل أجهزة التطبيق ولا يمكن سحبه بعد الإرسال.'
        : 'This reaches every app install and cannot be recalled once sent.',
      confirmLabel: isAr ? 'إرسال' : 'Send',
      variant: 'primary',
    });
    if (!ok) return;
    setSending(true);
    try {
      await adminApi.sendPushBroadcast({ ...form, imageUrl: form.imageUrl || undefined });
      toast.success(isAr ? 'تم إرسال الإشعار لكل مستخدمي التطبيق' : 'Sent to every app user');
      setForm(EMPTY);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الإرسال' : 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  if (!stats) {
    return <div className="flex justify-center py-20"><Loader size="lg" /></div>;
  }

  return (
    <PageHeader
      title={isAr ? 'إشعارات التطبيق' : 'App push notifications'}
      description={isAr
        ? 'أرسل عرضاً أو تنبيهاً لكل مستخدمي تطبيق iOS و Android. إشعارات الطلبات تُرسل تلقائياً.'
        : 'Send an offer or announcement to every iOS and Android app user. Order updates are pushed automatically.'}
    >
      {!stats.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            {isAr
              ? 'الإشعارات غير مفعّلة بعد: أضف بيانات حساب خدمة Firebase على الخادم (FIREBASE_SERVICE_ACCOUNT_JSON). يتم حفظ أجهزة المستخدمين من الآن وستصلهم الإشعارات فور التفعيل.'
              : 'Push is not active yet: add the Firebase service account on the server (FIREBASE_SERVICE_ACCOUNT_JSON). Devices are already being registered and will receive pushes as soon as it is set.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Smartphone} label={isAr ? 'أجهزة مسجّلة' : 'Registered devices'} value={stats.devices} />
        <Stat icon={Smartphone} label="Android" value={stats.byPlatform?.android || 0} />
        <Stat icon={Smartphone} label="iOS" value={stats.byPlatform?.ios || 0} />
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-white p-5">
        <h3 className="flex items-center gap-2 font-bold text-text">
          <BellRing className="h-5 w-5 text-primary-600" aria-hidden />
          {isAr ? 'إشعار جديد' : 'New broadcast'}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3" dir="rtl">
            <Input name="titleAr" label="العنوان (عربي)" value={form.titleAr} onChange={set('titleAr')} maxLength={120} />
            <Textarea name="bodyAr" label="النص (عربي)" value={form.bodyAr} onChange={set('bodyAr')} maxLength={500} />
          </div>
          <div className="space-y-3" dir="ltr">
            <Input name="titleEn" label="Title (English)" value={form.titleEn} onChange={set('titleEn')} maxLength={120} />
            <Textarea name="bodyEn" label="Message (English)" value={form.bodyEn} onChange={set('bodyEn')} maxLength={500} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            name="link"
            label={isAr ? 'يفتح عند الضغط (مسار داخل التطبيق)' : 'Opens on tap (in-app path)'}
            placeholder="/offers"
            value={form.link}
            onChange={set('link')}
            error={form.link && !form.link.startsWith('/') ? (isAr ? 'يجب أن يبدأ بـ /' : 'Must start with /') : undefined}
            dir="ltr"
          />
          <Input
            name="imageUrl"
            label={isAr ? 'صورة (اختياري، https)' : 'Image (optional, https)'}
            placeholder="https://…"
            value={form.imageUrl}
            onChange={set('imageUrl')}
            dir="ltr"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={send} disabled={!valid || !stats.configured} loading={sending}>
            <Send className="h-4 w-4" aria-hidden />
            {isAr ? 'إرسال للجميع' : 'Send to everyone'}
          </Button>
        </div>
      </section>

    </PageHeader>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-xl font-bold tabular-nums text-text">{value}</p>
      </div>
    </div>
  );
}
