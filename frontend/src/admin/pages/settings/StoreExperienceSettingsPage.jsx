import { Sparkles } from 'lucide-react';
import Input from '../../../components/ui/Input';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

export default function StoreExperienceSettingsPage() {
  const { settings, loading, saving, save, update, isAr } = useStoreSettingsForm();

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <section className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'تجربة العميل' : 'Customer experience'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? 'تنبيهات ورسائل تظهر للعميل أثناء التسوق' : 'Alerts and messages shown to shoppers'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingToggleCard
            accent="primary"
            checked={settings.aiChatEnabled !== false}
            onChange={(v) => update('aiChatEnabled', v)}
            title={isAr ? 'المساعد الذكي (AI Chat)' : 'AI chat assistant'}
            description={isAr
              ? 'عند التفعيل يظهر زر المحادثة للعملاء ويمكنهم التسوق والاستفسار عبر المساعد.'
              : 'When enabled, customers see the chat button and can shop or ask questions via the assistant.'}
          />

          <SettingToggleCard
            accent="amber"
            checked={settings.lowStockAlertEnabled !== false}
            onChange={(v) => update('lowStockAlertEnabled', v)}
            title={isAr ? 'تنبيه المخزون المنخفض' : 'Low stock alert'}
            description={isAr
              ? 'يظهر على بطاقة المنتج عندما يقترب المخزون من النفاد.'
              : 'Shows on the product card when stock is running low.'}
          />

          <SettingToggleCard
            accent="violet"
            checked={settings.reviewSettings?.autoRequestOnDelivered !== false}
            onChange={(v) => update('reviewSettings', { ...settings.reviewSettings, autoRequestOnDelivered: v })}
            title={isAr ? 'طلب التقييم بعد التسليم' : 'Review request after delivery'}
            description={isAr
              ? 'إرسال تلقائي لطلب التقييم عند اكتمال التوصيل.'
              : 'Automatically ask customers to rate after delivery.'}
          />
        </div>

        <details className="mt-6 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل تنبيه المخزون' : 'Low stock details'}
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              label={isAr ? 'حد ظهور التنبيه' : 'Show alert when stock is at or below'}
              type="number"
              min="1"
              max="9999"
              disabled={settings.lowStockAlertEnabled === false}
              value={settings.lowStockAlertThreshold}
              onChange={(e) => update('lowStockAlertThreshold', e.target.value)}
            />
            <Input
              label={isAr ? 'نص التنبيه (عربي)' : 'Alert text (Arabic)'}
              disabled={settings.lowStockAlertEnabled === false}
              value={settings.lowStockMessageAr}
              onChange={(e) => update('lowStockMessageAr', e.target.value)}
              placeholder="باقي {{qty}} فقط"
            />
            <Input
              label={isAr ? 'نص التنبيه (EN)' : 'Alert text (English)'}
              disabled={settings.lowStockAlertEnabled === false}
              value={settings.lowStockMessageEn}
              onChange={(e) => update('lowStockMessageEn', e.target.value)}
              placeholder="Only {{qty}} left"
            />
          </div>
        </details>

        <details className="mt-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل طلب التقييم' : 'Review request details'}
          </summary>
          <div className="mt-4 space-y-3">
            <SettingToggleCard
              checked={settings.reviewSettings?.requestSms !== false}
              onChange={(v) => update('reviewSettings', { ...settings.reviewSettings, requestSms: v })}
              title="SMS"
              description={isAr ? 'إرسال طلب التقييم عبر رسالة نصية' : 'Send review request via SMS'}
            />
            <SettingToggleCard
              checked={settings.reviewSettings?.requestEmail !== false}
              onChange={(v) => update('reviewSettings', { ...settings.reviewSettings, requestEmail: v })}
              title={isAr ? 'البريد الإلكتروني' : 'Email'}
              description={isAr ? 'إرسال طلب التقييم عبر البريد' : 'Send review request via email'}
            />
          </div>
        </details>

        <details className="mt-4 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل إشعار السلة' : 'Add-to-cart toast details'}
          </summary>
          <p className="mt-3 text-xs text-text-muted">
            {isAr ? 'المتغيرات: {{qty}} و {{name}}' : 'Placeholders: {{qty}} and {{name}}'}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              label={isAr ? 'النص (عربي)' : 'Message (Arabic)'}
              value={settings.cartToastAddedAr}
              onChange={(e) => update('cartToastAddedAr', e.target.value)}
              placeholder="تمت إضافة {{qty}} × {{name}} إلى السلة"
            />
            <Input
              label={isAr ? 'النص (EN)' : 'Message (English)'}
              value={settings.cartToastAddedEn}
              onChange={(e) => update('cartToastAddedEn', e.target.value)}
              placeholder="Added {{qty}} × {{name}} to cart"
            />
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
