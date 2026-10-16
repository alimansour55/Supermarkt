import { useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import Section, { Toggle } from './Section';
import { errorText } from './integrationMeta';

const HOLD_OPTIONS = [
  {
    id: 'until_delivered',
    labelAr: 'حتى يتم توصيل الطلب',
    labelEn: 'Until the order is delivered',
    hintAr: 'مناسب لو الكاشير يسجل البيع عند تجهيز الطلب أو توصيله.',
    hintEn: 'Best when the cashier rings up the sale while packing or delivering.',
  },
  {
    id: 'ack',
    labelAr: 'حتى يؤكد النظام الآخر أنه خصمها',
    labelEn: 'Until the other system confirms it took them out',
    hintAr: 'لأنظمة تقرأ الطلبات الأونلاين وتخصمها بنفسها (API أو برنامج المحل).',
    hintEn: 'For systems that read online orders and take them out themselves (API or shop program).',
  },
  {
    id: 'none',
    labelAr: 'لا تحجز',
    labelEn: 'Do not hold',
    hintAr: 'الرقم القادم من النظام الآخر يُستخدم كما هو.',
    hintEn: 'The number from the other system is used as it is.',
  },
];

/** Store-wide sync rules: safety buffer, online-order hold, which branches sell online, alerts. */
export default function SyncRulesTab({ settings, locations, stats, onSaved, isAr }) {
  const toast = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await integrationsApi.updateSettings({
        stockBuffer: form.stockBuffer,
        onlineOrderHold: form.onlineOrderHold,
        onlineLocations: form.onlineLocations,
        alertEmails: Array.isArray(form.alertEmails) ? form.alertEmails : String(form.alertEmails || ''),
        alertOnUnmatched: form.alertOnUnmatched,
      });
      onSaved(res.data.data);
      toast.success(isAr ? 'تم الحفظ — جاري إعادة حساب المخزون' : 'Saved — website stock is being recalculated');
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setSaving(false);
    }
  };

  const rebuild = async () => {
    try {
      await integrationsApi.rebuildStock();
      toast.success(isAr ? 'بدأت إعادة الحساب' : 'Recalculation started');
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  const allBranches = !form.onlineLocations?.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-4 text-sm text-text shadow-sm">
        <p className="font-semibold">{isAr ? 'كيف نحسب المخزون المعروض في الموقع' : 'How website stock is worked out'}</p>
        <p dir={isAr ? 'rtl' : 'ltr'} className="mt-1 text-text-muted">
          {isAr
            ? 'المخزون في الموقع = الكمية في الفروع التي تبيع أونلاين − هامش الأمان − الطلبات الأونلاين المحجوزة'
            : 'Website stock = quantity at branches that sell online − safety buffer − online orders on hold'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {isAr ? `${stats.syncedProducts} منتج مخزونه يأتي من أنظمة مربوطة.` : `${stats.syncedProducts} product(s) get their stock from connected systems.`}
        </p>
      </div>

      <Section
        title={isAr ? 'هامش الأمان' : 'Safety buffer'}
        hint={isAr ? 'نخفي هذا العدد من كل منتج حتى لا يُباع أونلاين آخر قطعة أخذها عميل من الرف.' : 'Hide this many of each product so the last piece someone just took off the shelf is not sold online.'}
      >
        <div className="max-w-[10rem]">
          <Input name="stockBuffer" type="number" min={0} max={1000} value={form.stockBuffer} onChange={(e) => set({ stockBuffer: Number(e.target.value) })} />
        </div>
      </Section>

      <Section
        title={isAr ? 'الطلبات الأونلاين' : 'Online orders'}
        hint={isAr ? 'إلى متى نخصم الطلب الأونلاين من الرقم القادم من الكاشير، حتى لا "يرجع" المخزون المباع؟' : 'How long an online order stays subtracted from the cashier’s number, so sold items are not "given back"?'}
      >
        {HOLD_OPTIONS.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="hold" className="mt-1" checked={form.onlineOrderHold === o.id} onChange={() => set({ onlineOrderHold: o.id })} />
            <span>
              <span className="block text-sm font-medium">{isAr ? o.labelAr : o.labelEn}</span>
              <span className="block text-xs text-text-muted">{isAr ? o.hintAr : o.hintEn}</span>
            </span>
          </label>
        ))}
      </Section>

      <Section
        title={isAr ? 'الفروع التي تبيع أونلاين' : 'Branches that sell online'}
        hint={isAr ? 'مخزون الفروع غير المختارة لا يظهر في الموقع.' : 'Stock at branches you leave out is not sold on the website.'}
      >
        <Toggle checked={allBranches} onChange={(v) => set({ onlineLocations: v ? [] : locations.map((l) => l.id) })} label={isAr ? 'كل الفروع' : 'All branches'} />
        {!allBranches && (
          <div className="grid gap-2 sm:grid-cols-2">
            {locations.map((l) => (
              <Toggle
                key={l.id}
                checked={form.onlineLocations.includes(l.id)}
                onChange={(on) => set({ onlineLocations: on ? [...form.onlineLocations, l.id] : form.onlineLocations.filter((x) => x !== l.id) })}
                label={l.name}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={isAr ? 'التنبيهات' : 'Alerts'}
        hint={isAr ? 'نرسل إشعاراً وبريداً عند فشل المزامنة (مرة كل ساعة كحد أقصى لكل ربط).' : 'We send an app notification and an email when a sync fails (at most hourly per connection).'}
      >
        <Input
          label={isAr ? 'البريد (اتركه فارغاً لإرسالها للمديرين)' : 'Emails (empty = all admins)'}
          name="alertEmails"
          dir="ltr"
          value={Array.isArray(form.alertEmails) ? form.alertEmails.join(', ') : form.alertEmails}
          onChange={(e) => set({ alertEmails: e.target.value })}
          placeholder="owner@shop.com, stock@shop.com"
        />
        <Toggle checked={form.alertOnUnmatched} onChange={(v) => set({ alertOnUnmatched: v })} label={isAr ? 'نبهني أيضاً عند وصول باركود غير موجود في المتجر' : 'Also alert me when an unknown barcode arrives'} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" />
          {isAr ? 'حفظ القواعد' : 'Save rules'}
        </Button>
        <Button variant="outline" onClick={rebuild}>
          <RefreshCw className="h-4 w-4" />
          {isAr ? 'أعد حساب مخزون الموقع الآن' : 'Recalculate website stock now'}
        </Button>
      </div>
    </div>
  );
}
