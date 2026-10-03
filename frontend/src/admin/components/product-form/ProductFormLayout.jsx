import { useState } from 'react';
import { Eye } from 'lucide-react';
import AdminSlidePanel from '../AdminSlidePanel';

export default function ProductFormLayout({ isAr, sideNav, previewCard, stickyBar, children }) {
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_18rem] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-4">{sideNav}</div>

        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={() => setMobilePreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-slate-50 lg:hidden"
          >
            <Eye className="h-3.5 w-3.5" />
            {isAr ? 'معاينة المنتج' : 'Preview product'}
          </button>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
            {children}
          </div>

          {stickyBar}
        </div>

        <div className="hidden lg:sticky lg:top-4 lg:block">{previewCard}</div>
      </div>

      <AdminSlidePanel
        open={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        isAr={isAr}
        title={isAr ? 'معاينة المنتج' : 'Product preview'}
        width="max-w-sm"
      >
        {previewCard}
      </AdminSlidePanel>
    </div>
  );
}
