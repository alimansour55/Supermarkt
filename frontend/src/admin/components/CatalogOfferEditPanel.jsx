import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye } from 'lucide-react';
import { Link } from '../../app/router';
import Input from '../../components/ui/Input';
import { adminApi } from '../adminApi';
import { pickProductImage } from '../../utils/imageHelpers';

const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50];

function calcDiscount(oldPrice, price) {
  const oldP = Number(oldPrice);
  const newP = Number(price);
  if (!oldP || oldP <= newP) return 0;
  return Math.round(((oldP - newP) / oldP) * 100);
}

export default function CatalogOfferEditPanel({
  isAr,
  row,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    oldPrice: '',
    price: '',
    offerActive: true,
  });

  useEffect(() => {
    if (!row) return;
    setForm({
      oldPrice: row.oldPrice ?? row.price ?? '',
      price: row.price ?? '',
      offerActive: row.offerActive !== false,
    });
    setError('');
  }, [row]);

  const previewDiscount = useMemo(
    () => calcDiscount(form.oldPrice, form.price),
    [form.oldPrice, form.price],
  );

  if (!row) return null;

  const title = isAr ? (row.nameAr || row.nameEn) : (row.nameEn || row.nameAr);
  const image = pickProductImage(row);
  const managed = row.source === 'managed';
  const storefrontUrl = row.slug ? `/products/${row.slug}` : null;

  const applyPreset = (pct) => {
    const base = Number(form.oldPrice || form.price || row.price);
    if (!base) return;
    setForm((prev) => ({
      ...prev,
      oldPrice: String(base),
      price: String(Math.round(base * (1 - pct / 100) * 100) / 100),
      offerActive: true,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = managed
        ? { offerActive: form.offerActive }
        : {
          oldPrice: Number(form.oldPrice) || null,
          price: Number(form.price),
          offerActive: form.offerActive,
        };
      const { data } = await adminApi.patchCatalogOffer(row._id, payload);
      onSaved(data.data);
    } catch (err) {
      setError(err?.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex gap-4 rounded-2xl border border-border bg-slate-50/80 p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          {image && (String(image).startsWith('http') || String(image).startsWith('/')) ? (
            <img src={image} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-3xl">{row.emoji || '🛍️'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text">{title}</p>
          <p className="text-xs text-text-muted">{row.brand} · {row.slug}</p>
          {previewDiscount > 0 && (
            <span className="mt-2 inline-block rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
              -{previewDiscount}%
            </span>
          )}
        </div>
      </div>

      {managed && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          {isAr
            ? '↪ السعر مُدار بواسطة حملة — يمكنك إيقاف/تفعيل الظهور فقط. عدّل السعر من تبويب «حملات العروض».'
            : '↪ Price is campaign-managed — you can pause/activate visibility only. Edit price under Campaigns tab.'}
        </div>
      )}

      {!managed && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={isAr ? 'السعر قبل الخصم' : 'Was price (EGP)'}
              type="number"
              min="0"
              step="0.01"
              value={form.oldPrice}
              onChange={(e) => setForm((p) => ({ ...p, oldPrice: e.target.value }))}
              dir="ltr"
            />
            <Input
              label={isAr ? 'سعر العرض' : 'Sale price (EGP)'}
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              dir="ltr"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-text">{isAr ? 'خصم سريع' : 'Quick discount'}</p>
            <div className="flex flex-wrap gap-2">
              {DISCOUNT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPreset(pct)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    previewDiscount === pct
                      ? 'bg-orange-600 text-white'
                      : 'border border-border bg-white hover:border-orange-300'
                  }`}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-white p-4">
        <input
          type="checkbox"
          checked={form.offerActive}
          onChange={(e) => setForm((p) => ({ ...p, offerActive: e.target.checked }))}
          className="h-4 w-4"
        />
        <div>
          <p className="text-sm font-semibold text-text">{isAr ? 'عرض نشط في المتجر' : 'Live on storefront'}</p>
          <p className="text-xs text-text-muted">
            {isAr ? 'عند الإيقاف لن يظهر في صفحة العروض والأقسام' : 'When off, hidden from offers page & sections'}
          </p>
        </div>
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ بدون إعادة تحميل' : 'Save (no reload)')}
        </button>
        {storefrontUrl && (
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            {isAr ? 'معاينة المتجر' : 'Preview store'}
          </a>
        )}
        <Link
          to={`/admin/products/${row._id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-muted hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          {isAr ? 'تفاصيل المنتج' : 'Full product'}
        </Link>
      </div>
    </form>
  );
}

export { DISCOUNT_PRESETS, calcDiscount };
