import { Link } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader } from './index';

export default function SettingsFormShell({
  isAr,
  loading,
  saving,
  onSubmit,
  children,
  backLabel,
}) {
  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        action={(
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        )}
      />

      <Link
        to="/admin/settings"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {backLabel || (isAr ? 'العودة لإعدادات المتجر' : 'Back to store settings')}
      </Link>

      {children}
    </form>
  );
}
