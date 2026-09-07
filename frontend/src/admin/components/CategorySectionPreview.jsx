import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Package } from 'lucide-react';
import { adminApi } from '../adminApi';
import {
  categoryHasChildren,
  categoryLabel,
  childrenOf,
} from '../../utils/categoryHelpers';
import { pickProductImage } from '../../utils/imageHelpers';
import {
  buildSectionProductPreviewParams,
  normalizeProductLimit,
  productDisplayName,
} from '../utils/productSourceUtils';
import {
  resolveSectionCategoryHealth,
  sectionCategoryWarningCopy,
} from '../utils/sectionCategoryHealth';
import SectionCategoryWarning from './SectionCategoryWarning';

function PreviewProductChip({ product, isAr }) {
  const image = pickProductImage(product);
  const name = productDisplayName(product, isAr);
  const price = Number(product.price ?? 0);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
        {image ? (
          <img src={image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <Package className="h-4 w-4 text-slate-300" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-text">{name}</p>
        <p className="text-[10px] tabular-nums text-text-muted">
          {price.toFixed(price % 1 ? 2 : 0)} EGP
        </p>
      </div>
    </div>
  );
}

export default function CategorySectionPreview({
  categoryId = '',
  categories = [],
  categoryIssue = null,
  isAr = true,
  productQuery = {},
  sectionLimit,
  requireLeaf = false,
  sampleSize = 6,
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(null);
  const [sample, setSample] = useState([]);

  const category = useMemo(
    () => (categoryId ? categories.find((c) => String(c._id) === String(categoryId)) : null),
    [categories, categoryId],
  );

  const health = useMemo(
    () => resolveSectionCategoryHealth({ categoryId, category, categoryIssue, categories }),
    [categoryId, category, categoryIssue, categories],
  );
  const brokenLink = health.status === 'missing' || health.status === 'inactive';

  const displayLimit = normalizeProductLimit(sectionLimit ?? productQuery?.limit, 12);
  const hasChildren = category ? categoryHasChildren(categories, category._id) : false;
  const childCount = category ? childrenOf(categories, category._id).length : 0;
  const isInactive = category?.isActive === false;
  const needsLeaf = requireLeaf && hasChildren;
  const isEmpty = total === 0;

  const filterKey = useMemo(
    () => JSON.stringify({
      sort: productQuery?.sort || 'newest',
      section: productQuery?.section || '',
      brand: productQuery?.brand || '',
      offers: !!productQuery?.offers,
    }),
    [productQuery?.sort, productQuery?.section, productQuery?.brand, productQuery?.offers],
  );

  const warnings = useMemo(() => {
    const rows = [];
    const linkCopy = sectionCategoryWarningCopy(health, isAr);
    if (linkCopy) {
      rows.push({
        tone: linkCopy.tone === 'danger' ? 'danger' : 'warning',
        textAr: `${linkCopy.titleAr} — ${linkCopy.bodyAr}`,
        textEn: `${linkCopy.titleEn} — ${linkCopy.bodyEn}`,
      });
    }
    if (!category && !brokenLink) return rows;
    if (isInactive) {
      rows.push({
        tone: 'danger',
        textAr: 'هذا القسم غير نشط — لن يظهر للعملاء في المتجر.',
        textEn: 'This category is inactive — it is hidden from the storefront.',
      });
    }
    if (needsLeaf) {
      rows.push({
        tone: 'danger',
        textAr: 'يجب اختيار قسم فرعي بدون أبناء — المنتجات تُربط بالأقسام الورقية فقط.',
        textEn: 'Pick a leaf subcategory — products attach to deepest categories only.',
      });
    }
    if (!loading && total !== null && isEmpty) {
      rows.push({
        tone: 'warning',
        textAr: 'لا توجد منتجات نشطة تطابق هذا القسم والفلاتر — القسم سيظهر فارغاً.',
        textEn: 'No active products match this category and filters — the section will appear empty.',
      });
    }
    return rows;
  }, [category, health, brokenLink, isInactive, needsLeaf, loading, total, isEmpty, isAr]);

  useEffect(() => {
    if (!categoryId || needsLeaf || brokenLink) {
      setTotal(null);
      setSample([]);
      setError('');
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = buildSectionProductPreviewParams(productQuery, {
          categories,
          categoryId,
          sampleSize,
        });
        const { data } = await adminApi.getProducts(params);
        if (!active) return;
        const items = data.data || [];
        setSample(items);
        setTotal(data.pagination?.total ?? items.length);
      } catch {
        if (!active) return;
        setSample([]);
        setTotal(null);
        setError(isAr ? 'تعذّر تحميل معاينة المنتجات' : 'Could not load product preview');
      } finally {
        if (active) setLoading(false);
      }
    }, 320);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [categoryId, categories, filterKey, isAr, needsLeaf, brokenLink, sampleSize]);

  if (!categoryId) return null;

  if (brokenLink) {
    return (
      <SectionCategoryWarning
        categoryId={categoryId}
        category={category}
        categoryIssue={categoryIssue || health.status}
        categories={categories}
        isAr={isAr}
        className={className}
      />
    );
  }

  if (!category) return null;

  const shownCount = Math.min(total ?? 0, displayLimit);
  const statusTone = warnings.some((w) => w.tone === 'danger')
    ? 'danger'
    : warnings.length
      ? 'warning'
      : 'ok';

  const statusClasses = {
    ok: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-950',
    danger: 'border-red-200 bg-red-50/80 text-red-950',
  };

  return (
    <div className={`space-y-3 rounded-xl border border-border bg-slate-50/50 p-3 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'معاينة القسم' : 'Section preview'}
          </p>
          {loading ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isAr ? 'جار الحساب…' : 'Calculating…'}
            </p>
          ) : total !== null ? (
            <p className={`mt-1 text-sm font-bold ${statusTone === 'ok' ? 'text-emerald-900' : statusTone === 'warning' ? 'text-amber-900' : 'text-red-900'}`}>
              {isAr
                ? `${total} منتج مطابق — سيُعرض حتى ${shownCount}`
                : `${total} matching product${total === 1 ? '' : 's'} — up to ${shownCount} shown`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-muted">
              {isAr ? 'اختر قسماً لمعاينة المنتجات' : 'Select a category to preview products'}
            </p>
          )}
        </div>
        {hasChildren && !requireLeaf && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900">
            {isAr ? `${childCount} فرعي` : `${childCount} sub`}
          </span>
        )}
      </div>

      {hasChildren && !requireLeaf && !needsLeaf && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          {isAr
            ? `يشمل منتجات «${categoryLabel(category, isAr)}» وجميع الأقسام الفرعية الورقية تحته.`
            : `Includes products in «${categoryLabel(category, isAr)}» and all leaf subcategories below it.`}
        </p>
      )}

      {warnings.map((warning) => (
        <div
          key={warning.textEn}
          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${
            warning.tone === 'danger'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {warning.tone === 'danger' ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{isAr ? warning.textAr : warning.textEn}</span>
        </div>
      ))}

      {error && (
        <p className="text-[11px] text-red-700">{error}</p>
      )}

      {!loading && !error && sample.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {isAr ? 'عينة' : 'Sample'}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {sample.map((product) => (
              <PreviewProductChip key={product._id} product={product} isAr={isAr} />
            ))}
          </div>
          {(total ?? 0) > sample.length && (
            <p className="mt-2 text-[10px] text-text-muted">
              {isAr
                ? `+ ${total - sample.length} منتج آخر يطابق الفلاتر`
                : `+ ${total - sample.length} more matching product${total - sample.length === 1 ? '' : 's'}`}
            </p>
          )}
        </div>
      )}

      {!loading && !error && total === 0 && !needsLeaf && (
        <div className={`rounded-lg border px-3 py-4 text-center text-xs ${statusClasses.warning}`}>
          {isAr
            ? 'لا منتجات — أضف منتجات لهذا القسم أو غيّر الفلاتر.'
            : 'No products — add products to this category or adjust filters.'}
        </div>
      )}
    </div>
  );
}
