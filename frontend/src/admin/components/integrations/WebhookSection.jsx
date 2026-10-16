import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useConfirm, useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import Section, { Toggle } from './Section';
import SecretReveal from './SecretReveal';
import { EVENTS, errorText, timeAgo } from './integrationMeta';

const STATUS = {
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
};

/** Webhooks: where to send order events, which ones, test, secret, and the delivery list with retry. */
export default function WebhookSection({ conn, onSaved, isAr }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState(conn.webhook.url);
  const [events, setEvents] = useState(conn.webhook.events);
  const [busy, setBusy] = useState('');
  const [secret, setSecret] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [testResult, setTestResult] = useState(null);

  const loadDeliveries = () => integrationsApi.deliveries(conn.id)
    .then((res) => setDeliveries(res.data.data || []))
    .catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDeliveries(); }, []);

  const save = async (enabled = conn.webhook.enabled) => {
    setBusy('save');
    try {
      const res = await integrationsApi.update(conn.id, { webhook: { url, events, enabled } });
      onSaved(res.data.data);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      return true;
    } catch (err) {
      toast.error(errorText(err, isAr));
      return false;
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    if (!(await save())) return;
    setBusy('test');
    try {
      const res = await integrationsApi.test(conn.id, 'webhook');
      setTestResult(res.data.data);
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err, isAr) });
    } finally {
      setBusy('');
    }
  };

  const rotate = async () => {
    const ok = await confirm({
      title: isAr ? 'سر جديد؟' : 'New secret?',
      message: isAr ? 'النظام الآخر يجب أن يستخدم السر الجديد للتحقق من الإشعارات.' : 'The other system must switch to the new secret to verify notifications.',
      confirmLabel: isAr ? 'إنشاء سر جديد' : 'Create new secret',
    });
    if (!ok) return;
    try {
      const res = await integrationsApi.rotateWebhookSecret(conn.id);
      setSecret(res.data.data.webhookSecret);
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  const retry = async (id) => {
    try {
      const res = await integrationsApi.retryDelivery(id);
      toast[res.data.data.status === 'delivered' ? 'success' : 'error'](
        res.data.data.status === 'delivered' ? (isAr ? 'تم الإرسال' : 'Delivered') : (res.data.data.lastError || (isAr ? 'فشل مرة أخرى' : 'Failed again')),
      );
      loadDeliveries();
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  return (
    <Section
      title={isAr ? 'إشعارات الطلبات (Webhook)' : 'Order notifications (webhook)'}
      hint={isAr ? 'نرسل لنظامك فوراً، موقّعة، ونعيد المحاولة لمدة يومين لو كان نظامك متوقفاً.' : 'Sent at once, signed, and retried for two days if your system is down.'}
    >
      <Input label={isAr ? 'عنوان الاستقبال' : 'Receiving address'} name="webhookUrl" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-system.com/webhooks/marketplus" />
      <div className="grid gap-2 sm:grid-cols-2">
        {EVENTS.map((ev) => (
          <Toggle
            key={ev.id}
            checked={events.includes(ev.id)}
            onChange={(on) => setEvents((list) => (on ? [...list, ev.id] : list.filter((x) => x !== ev.id)))}
            label={isAr ? ev.labelAr : ev.labelEn}
            hint={ev.id}
          />
        ))}
      </div>
      <Toggle
        checked={conn.webhook.enabled}
        onChange={(on) => save(on)}
        label={isAr ? 'الإرسال مفعّل' : 'Sending is on'}
        disabled={!url}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => save()} loading={busy === 'save'}>
          <Save className="h-4 w-4" />
          {isAr ? 'حفظ' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={sendTest} loading={busy === 'test'} disabled={!url}>
          <Send className="h-4 w-4" />
          {isAr ? 'إرسال تجربة' : 'Send a test'}
        </Button>
        <Button size="sm" variant="ghost" onClick={rotate}>
          <RotateCcw className="h-4 w-4" />
          {isAr ? 'سر توقيع جديد' : 'New signing secret'}
        </Button>
      </div>
      {testResult && (
        <p className={`rounded-xl px-3 py-2 text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {testResult.message}
        </p>
      )}
      {secret && <SecretReveal isAr={isAr} webhookSecret={secret} onDone={() => setSecret('')} />}

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{isAr ? 'آخر الإشعارات' : 'Recent notifications'}</p>
          <button type="button" onClick={loadDeliveries} className="rounded-lg p-1 text-text-muted hover:bg-slate-100" aria-label={isAr ? 'تحديث' : 'Refresh'}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {deliveries.length === 0 ? (
          <p className="text-xs text-text-muted">{isAr ? 'لا شيء بعد' : 'Nothing yet'}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {deliveries.map((d) => (
              <li key={d._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS[d.status]}`}>{d.status}</span>
                <span dir="ltr" className="font-mono">{d.event}</span>
                <span className="text-text-muted">{timeAgo(d.createdAt, isAr)}</span>
                {d.attempts > 1 && <span className="text-text-muted">×{d.attempts}</span>}
                {d.lastError && <span className="min-w-0 flex-1 truncate text-red-700" title={d.lastError}>{d.lastError}</span>}
                {d.status !== 'delivered' && (
                  <button type="button" onClick={() => retry(d._id)} className="ms-auto font-semibold text-primary-700">
                    {isAr ? 'أعد الإرسال' : 'Resend'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
