import { LayoutDashboard } from 'lucide-react';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

export default function StoreAdminSettingsPage() {
  const { settings, loading, saving, save, update, isAr } = useStoreSettingsForm();

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'لوحة التحكم' : 'Admin panel'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? 'تحكم في ما يراه المسؤولون داخل لوحة الإدارة' : 'Control what admins see in the dashboard'}
            </p>
          </div>
        </div>

        <SettingToggleCard
          checked={settings.adminPanel?.showRevenue !== false}
          onChange={(v) => update('adminPanel', { ...settings.adminPanel, showRevenue: v })}
          title={isAr ? 'عرض الإيرادات في لوحة التحكم' : 'Show revenue in admin panel'}
          description={isAr
            ? 'عند التفعيل تظهر صفحة الإيرادات والتقارير المالية وأرقام المبيعات.'
            : 'When enabled, the Revenue page, financial reports, and sales figures appear in admin.'}
        />
      </section>
    </SettingsFormShell>
  );
}
