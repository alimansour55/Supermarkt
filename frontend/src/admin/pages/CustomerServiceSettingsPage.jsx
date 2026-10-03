import { useMemo, useState } from 'react';
import { AlertTriangle, Headphones, Plus, Save } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { PageHeader } from '../components';
import ToggleSwitch from '../components/ToggleSwitch';
import CustomerServiceChannelEditorCard from '../components/CustomerServiceChannelEditorCard';
import { useStoreSettingsForm } from '../hooks/useStoreSettingsForm';

function sortChannels(channels) {
  return [...(channels || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

let newChannelSeq = 0;

export default function CustomerServiceSettingsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings, loading, saving, save, update, updateNested } = useStoreSettingsForm();
  const [expandedId, setExpandedId] = useState(null);

  const channels = useMemo(
    () => sortChannels(settings?.customerService?.channels),
    [settings?.customerService?.channels],
  );

  if (loading || !settings) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  const enabledCount = channels.filter((c) => c.enabled !== false).length;
  const customerServiceEnabled = settings.customerService?.enabled !== false;

  const updateChannels = (next) => update('customerService', { ...settings.customerService, channels: next });

  const updateChannelAt = (index, field, value) => {
    const next = [...channels];
    next[index] = { ...next[index], [field]: value };
    updateChannels(next);
  };

  const moveChannel = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= channels.length) return;
    const next = [...channels];
    [next[index], next[target]] = [next[target], next[index]];
    updateChannels(next.map((ch, sortIndex) => ({ ...ch, sortOrder: sortIndex })));
  };

  const addCustomChannel = () => {
    newChannelSeq += 1;
    const id = `custom-${Date.now()}-${newChannelSeq}`;
    const next = [
      ...channels,
      {
        id,
        type: 'custom',
        enabled: true,
        labelAr: isAr ? 'قناة جديدة' : 'New channel',
        labelEn: 'New channel',
        descriptionAr: '',
        descriptionEn: '',
        value: '',
        icon: '',
        sortOrder: channels.length,
      },
    ];
    updateChannels(next);
    setExpandedId(id);
  };

  const removeChannel = (id) => {
    updateChannels(channels.filter((ch) => ch.id !== id).map((ch, i) => ({ ...ch, sortOrder: i })));
  };

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

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Headphones className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">{isAr ? 'خدمة العملاء' : 'Customer service'}</h2>
              <p className="text-sm text-text-muted">
                {isAr
                  ? 'فعّل وأضف قنوات التواصل التي تظهر للعميل في صفحة "اتصل بنا" وداخل المساعد الذكي'
                  : 'Enable and add the contact channels shown to customers on the Contact page and inside the AI assistant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enabledCount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {enabledCount} {isAr ? 'مفعّلة' : 'active'}
            </span>
            <label className="flex items-center gap-2 text-sm font-semibold">
              {isAr ? 'تفعيل الميزة' : 'Feature enabled'}
              <ToggleSwitch
                checked={customerServiceEnabled}
                onChange={(value) => updateNested('customerService', 'enabled', value)}
                ariaLabel={isAr ? 'تفعيل خدمة العملاء' : 'Enable customer service'}
              />
            </label>
          </div>
        </div>

        {enabledCount === 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {isAr
                ? 'فعّل قناة واحدة على الأقل حتى يظهر شيء للعميل.'
                : 'Enable at least one channel so customers see something.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {channels.map((channel, index) => (
            <div key={channel.id || index} className="relative">
              <CustomerServiceChannelEditorCard
                channel={channel}
                index={index}
                total={channels.length}
                isAr={isAr}
                expanded={expandedId === channel.id}
                onToggleExpand={() => setExpandedId((current) => (current === channel.id ? null : channel.id))}
                onUpdate={(field, value) => updateChannelAt(index, field, value)}
                onMoveUp={() => moveChannel(index, -1)}
                onMoveDown={() => moveChannel(index, 1)}
              />
              {channel.type === 'custom' && (
                <button
                  type="button"
                  onClick={() => removeChannel(channel.id)}
                  className="absolute -top-2 -end-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm hover:bg-red-700"
                >
                  {isAr ? 'حذف' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCustomChannel}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 bg-primary-50/40 px-4 py-3 text-sm font-semibold text-primary-700 transition hover:border-primary-400 hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'إضافة قناة تواصل مخصّصة' : 'Add a custom contact channel'}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">{isAr ? 'إعدادات "اطلب اتصال"' : '"Request a call back" settings'}</h2>
        <p className="mb-4 text-sm text-text-muted">
          {isAr
            ? 'النص الذي يراه العميل بعد إرسال طلب الاتصال'
            : 'Shown to the customer after they submit a callback request'}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={isAr ? 'رسالة التأكيد (عربي)' : 'Confirmation note (Arabic)'}
            value={settings.customerService?.callback?.noteAr || ''}
            onChange={(e) => update('customerService', {
              ...settings.customerService,
              callback: { ...settings.customerService?.callback, noteAr: e.target.value },
            })}
          />
          <Input
            label={isAr ? 'رسالة التأكيد (English)' : 'Confirmation note (English)'}
            value={settings.customerService?.callback?.noteEn || ''}
            onChange={(e) => update('customerService', {
              ...settings.customerService,
              callback: { ...settings.customerService?.callback, noteEn: e.target.value },
            })}
          />
          <Input
            label={isAr ? 'ساعات العمل (عربي)' : 'Working hours (Arabic)'}
            value={settings.customerService?.callback?.workingHoursAr || ''}
            onChange={(e) => update('customerService', {
              ...settings.customerService,
              callback: { ...settings.customerService?.callback, workingHoursAr: e.target.value },
            })}
          />
          <Input
            label={isAr ? 'ساعات العمل (English)' : 'Working hours (English)'}
            value={settings.customerService?.callback?.workingHoursEn || ''}
            onChange={(e) => update('customerService', {
              ...settings.customerService,
              callback: { ...settings.customerService?.callback, workingHoursEn: e.target.value },
            })}
          />
        </div>
      </section>
    </form>
  );
}
