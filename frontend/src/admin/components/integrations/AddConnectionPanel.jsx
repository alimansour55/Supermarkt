import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import AdminSlidePanel from '../AdminSlidePanel';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import { DOORS, errorText } from './integrationMeta';
import SecretReveal from './SecretReveal';

/** Add a connection in three short steps: how it connects → name (and system) → copy the key. */
export default function AddConnectionPanel({ open, onClose, onCreated, connectors, isAr }) {
  const toast = useToast();
  const [door, setDoor] = useState('');
  const [connectorKey, setConnectorKey] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const reset = () => {
    setDoor('');
    setConnectorKey('');
    setName('');
    setCreated(null);
  };
  const close = () => {
    if (created) onCreated(created.connection, { open: true });
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (door === 'connector' && !connectorKey) {
      toast.error(isAr ? 'اختر النظام' : 'Choose the system');
      return;
    }
    setSaving(true);
    try {
      const res = await integrationsApi.create({ name, door, connectorKey: connectorKey || undefined });
      setCreated(res.data.data);
      onCreated(res.data.data.connection, { open: false });
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setSaving(false);
    }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const showKey = created && ['api', 'agent', 'webhook'].includes(created.connection.door);

  return (
    <AdminSlidePanel
      open={open}
      onClose={close}
      isAr={isAr}
      width="max-w-2xl"
      title={isAr ? 'ربط نظام جديد' : 'Connect a system'}
      subtitle={isAr ? 'المخزون والأسعار والطلبات تتزامن تلقائياً بعد الربط' : 'Stock, prices and orders sync by themselves once connected'}
    >
      {created ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-semibold text-green-700">
            <Check className="h-5 w-5" />
            {isAr ? `تم إنشاء "${created.connection.name}"` : `"${created.connection.name}" is created`}
          </p>
          {showKey ? (
            <SecretReveal isAr={isAr} apiKey={created.apiKey} webhookSecret={created.webhookSecret} onDone={close} />
          ) : (
            <Button onClick={close}>{isAr ? 'متابعة الإعداد' : 'Continue setup'}</Button>
          )}
        </div>
      ) : !door ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            {isAr ? 'كيف يتصل نظامك بالمتجر؟ لو مش متأكد، اسأل الشركة التي باعتك برنامج الكاشير: "هل عندكم API؟"' : 'How does your system connect? Not sure? Ask whoever sold you the cashier program: "Do you have an API?"'}
          </p>
          {DOORS.map(({ id, Icon, labelAr, labelEn, descAr, descEn }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDoor(id)}
              className="flex w-full items-start gap-3 rounded-2xl border border-border bg-white p-4 text-start transition hover:border-primary-400 hover:bg-primary-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-text">{isAr ? labelAr : labelEn}</span>
                <span className="mt-0.5 block text-sm text-text-muted">{isAr ? descAr : descEn}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <button type="button" onClick={() => setDoor('')} className="flex items-center gap-1 text-sm font-semibold text-primary-700">
            <BackIcon className="h-4 w-4" />
            {isAr ? 'رجوع' : 'Back'}
          </button>

          {door === 'connector' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">{isAr ? 'أي نظام؟' : 'Which system?'}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {connectors.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setConnectorKey(c.key);
                      if (!name) setName(c.name);
                    }}
                    className={`rounded-xl border p-3 text-start transition ${connectorKey === c.key ? 'border-primary-500 bg-primary-50' : 'border-border bg-white hover:bg-slate-50'}`}
                  >
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{c.description}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted">
                {isAr ? 'نظامك غير موجود؟ اختر "نظام يتصل بنا (API)" أو "ملف Excel" أو "برنامج على كمبيوتر المحل".' : 'Not listed? Use "System that calls us (API)", "Excel or CSV file" or "Program on the shop PC".'}
              </p>
            </div>
          )}

          <Input
            label={isAr ? 'اسم يساعدك تتعرف عليه' : 'A name you will recognise'}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isAr ? 'مثال: كاشير الفرع الرئيسي' : 'e.g. Main shop cashier'}
            required
            maxLength={80}
          />
          <Button type="submit" loading={saving}>{isAr ? 'إنشاء' : 'Create'}</Button>
        </form>
      )}
    </AdminSlidePanel>
  );
}
