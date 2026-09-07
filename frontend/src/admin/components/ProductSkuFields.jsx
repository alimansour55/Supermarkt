import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RefreshCw,
  ScanBarcode,
} from 'lucide-react';
import { adminApi } from '../adminApi';
import { buildLocalSkuCandidates } from '../utils/productSkuUtils';

export default function ProductSkuFields({
  form,
  set,
  isAr,
  categories = [],
  productId,
}) {
  const [recommended, setRecommended] = useState('');
  const [skuStatus, setSkuStatus] = useState('idle');
  const [loadingSku, setLoadingSku] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBarcode, setShowBarcode] = useState(Boolean(form.barcode?.trim()));
  const skuManual = useRef(Boolean(form.sku?.trim()));
  const debounceRef = useRef(null);

  const leafCategory = categories.find((c) => String(c._id) === String(form.subCategory || form.category));
  const categorySlug = leafCategory?.slug || '';

  const fetchRecommended = useCallback(async (apply = false) => {
    const hasName = (form.nameEn || '').trim().length >= 2;
    if (!hasName && !form.slug) return;

    setLoadingSku(true);
    try {
      const { data } = await adminApi.suggestProductSku({
        nameEn: form.nameEn,
        brand: form.brand,
        unit: form.unit,
        slug: form.slug,
        categorySlug,
        excludeProductId: productId || undefined,
      });
      const next = data?.recommended || data?.suggestions?.[0] || '';
      setRecommended(next);
      if (apply && !skuManual.current && next) {
        set('sku', next);
      }
    } catch {
      const local = buildLocalSkuCandidates({
        nameEn: form.nameEn,
        brand: form.brand,
        unit: form.unit,
        slug: form.slug,
        categorySlug,
      });
      const next = local[0] || '';
      setRecommended(next);
      if (apply && !skuManual.current && next) {
        set('sku', next);
      }
    } finally {
      setLoadingSku(false);
    }
  }, [form.nameEn, form.brand, form.unit, form.slug, categorySlug, productId, set]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRecommended(!skuManual.current && !form.sku?.trim());
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [form.nameEn, form.brand, form.unit, form.slug, categorySlug, fetchRecommended, form.sku]);

  useEffect(() => {
    if (form.barcode?.trim()) setShowBarcode(true);
  }, [form.barcode]);

  useEffect(() => {
    const sku = (form.sku || '').trim();
    if (!sku) {
      setSkuStatus('idle');
      return undefined;
    }

    setSkuStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { data } = await adminApi.checkProductSku(sku, productId);
        setSkuStatus(data?.available ? 'available' : 'taken');
      } catch {
        setSkuStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.sku, productId]);

  const handleRegenerate = () => {
    skuManual.current = false;
    fetchRecommended(true);
  };

  const handleCopy = async () => {
    if (!form.sku) return;
    try {
      await navigator.clipboard.writeText(form.sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleGenerateBarcode = () => {
    const seed = form.sku || form.slug || form.nameEn || Date.now();
    adminApi.suggestProductSku({
      nameEn: form.nameEn,
      slug: form.slug,
      sku: form.sku,
      seed,
      barcodeOnly: true,
    }).then(({ data }) => {
      if (data?.barcode) set('barcode', data.barcode);
    }).catch(() => {
      let h = 0;
      const str = String(seed);
      for (let i = 0; i < str.length; i += 1) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
      set('barcode', `622${String(Math.abs(h) % 10000000000).padStart(10, '0')}`);
    });
  };

  const previewSku = form.sku?.trim() || recommended;
  const isAuto = !skuManual.current && !form.sku?.trim();

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label className="text-sm font-medium text-text">SKU</label>
          <p className="mt-0.5 text-xs text-text-muted">
            {isAr
              ? 'يُنشأ تلقائياً من اسم المنتج — يمكنك تعديله'
              : 'Created from the product name — edit anytime'}
          </p>
        </div>
        {!form.sku?.trim() && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
            {isAr ? 'تلقائي' : 'Auto'}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          className={[
            'w-full rounded-xl border bg-white py-2.5 ps-4 pe-[7.5rem] font-mono text-sm tracking-wide',
            'placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100',
            skuStatus === 'taken' ? 'border-red-300' : 'border-border',
          ].join(' ')}
          value={form.sku || ''}
          onChange={(e) => {
            skuManual.current = true;
            set('sku', e.target.value.toUpperCase().replace(/\s/g, ''));
          }}
          placeholder={previewSku || (isAr ? 'يُملأ تلقائياً عند الحفظ' : 'Filled automatically on save')}
        />

        <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {skuStatus === 'checking' && (
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden />
          )}
          {skuStatus === 'available' && form.sku?.trim() && (
            <Check className="h-4 w-4 text-emerald-600" aria-label={isAr ? 'متاح' : 'Available'} />
          )}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loadingSku}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-primary-600 disabled:opacity-50"
            title={isAr ? 'إنشاء SKU جديد' : 'Generate new SKU'}
          >
            {loadingSku ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!form.sku?.trim()}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-primary-600 disabled:opacity-40"
            title={isAr ? 'نسخ' : 'Copy'}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {skuStatus === 'taken' && (
        <p className="text-xs text-red-600">
          {isAr ? 'هذا الرمز مستخدم — ' : 'This SKU is taken — '}
          <button
            type="button"
            onClick={handleRegenerate}
            className="font-semibold underline underline-offset-2"
          >
            {isAr ? 'إنشاء رمز جديد' : 'generate a new one'}
          </button>
        </p>
      )}

      {isAuto && recommended && !form.sku?.trim() && (
        <p className="text-xs text-text-muted">
          {isAr ? 'سيُستخدم عند الحفظ:' : 'Will use on save:'}{' '}
          <span className="font-mono font-medium text-text">{recommended}</span>
        </p>
      )}

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowBarcode((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-start text-sm text-text-muted transition-colors hover:text-text"
        >
          <span className="inline-flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 shrink-0" />
            {isAr ? 'باركود للمسح الضوئي' : 'Barcode for scanning'}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">
              {isAr ? 'اختياري' : 'Optional'}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${showBarcode ? 'rotate-180' : ''}`}
          />
        </button>

        {showBarcode && (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border bg-slate-50/80 p-3">
            <p className="text-xs text-text-muted">
              {isAr
                ? 'أضفه فقط إذا كنت تستخدم قارئ باركود في المتجر أو المستودع. معظم المنتجات لا تحتاجه.'
                : 'Only needed if you scan products at checkout or in the warehouse. Most products skip this.'}
            </p>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm tracking-wider focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={form.barcode || ''}
                onChange={(e) => set('barcode', e.target.value.replace(/\D/g, ''))}
                placeholder="6220000000000"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={handleGenerateBarcode}
                className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-slate-50"
              >
                {isAr ? 'إنشاء' : 'Generate'}
              </button>
            </div>
            {form.barcode && (
              <button
                type="button"
                onClick={() => {
                  set('barcode', '');
                  setShowBarcode(false);
                }}
                className="text-xs text-text-muted hover:text-red-600"
              >
                {isAr ? 'إزالة الباركود' : 'Remove barcode'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
