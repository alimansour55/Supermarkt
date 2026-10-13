import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '../../app/router';
import { Keyboard, X } from 'lucide-react';

const GO = {
  h: { to: '/seller-center', ar: 'الرئيسية', en: 'Home' },
  o: { to: '/seller-center/orders', ar: 'الطلبات', en: 'Orders' },
  p: { to: '/seller-center/products', ar: 'المنتجات', en: 'Products' },
  i: { to: '/seller-center/inventory', ar: 'المخزون', en: 'Inventory' },
  r: { to: '/seller-center/reports', ar: 'التقارير', en: 'Reports' },
  f: { to: '/seller-center/finance', ar: 'المدفوعات', en: 'Payments' },
  s: { to: '/seller-center/store', ar: 'إعدادات المتجر', en: 'Store settings' },
};

const typing = (el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName) || el?.isContentEditable;

/**
 * Seller Center keyboard shortcuts (Gmail-style): N new product, G then a letter to jump,
 * / search (handled by the top bar), ? this help.
 */
export default function SellerShortcuts({ isAr }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement)) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') { setOpen(false); return; }
      if (e.key === '?') { e.preventDefault(); setOpen((v) => !v); return; }
      if (Date.now() - pendingG.current < 1200 && GO[key]) {
        e.preventDefault();
        pendingG.current = 0;
        setOpen(false);
        navigate(GO[key].to);
        return;
      }
      if (key === 'g') { pendingG.current = Date.now(); return; }
      if (key === 'n') { e.preventDefault(); navigate('/seller-center/products/new'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (!open) return null;
  const Row = ({ keys, label }) => (
    <li className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex gap-1" dir="ltr">{keys.map((k) => <kbd key={k} className="min-w-[1.6rem] rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-center font-mono text-xs shadow-sm">{k}</kbd>)}</span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={isAr ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold"><Keyboard className="h-5 w-5 text-indigo-600" />{isAr ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'}</h2>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="h-4 w-4" /></button>
        </div>
        <ul className="divide-y divide-slate-100">
          <Row keys={['/']} label={isAr ? 'بحث' : 'Search'} />
          <Row keys={['N']} label={isAr ? 'منتج جديد' : 'New product'} />
          {Object.entries(GO).map(([k, v]) => <Row key={k} keys={['G', k.toUpperCase()]} label={isAr ? `اذهب إلى ${v.ar}` : `Go to ${v.en}`} />)}
          <Row keys={['Ctrl', 'S']} label={isAr ? 'حفظ (في محرر المنتج)' : 'Save (product editor)'} />
          <Row keys={['?']} label={isAr ? 'إظهار / إخفاء هذه القائمة' : 'Show / hide this list'} />
        </ul>
      </div>
    </div>
  );
}
