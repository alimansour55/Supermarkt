import { useState } from 'react';
import { Link } from '../../app/router';
import { ChevronLeft, MapPin, Package, Pencil } from 'lucide-react';
import ProductImage from '../ui/ProductImage';
import OrderProgressLine from './OrderProgressLine';
import OrderTrackingPanel from './OrderTrackingPanel';
import Button from '../ui/Button';
import { formatPrice, formatDate, formatRelativeTime } from '../../utils/formatters';
import { getOrderStatusLabel, getOrderStatusColor } from '../../utils/orderStatus';
import { formatOrderNumber, isOrderActive } from '../../utils/orderNumber';
import { canCustomerEditOrder } from '../../utils/orderEditHelpers';
import { canTrackOrder } from '../../utils/orderTracking';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { scrollToTop } from '../../utils/scrollToTop';

function OrderThumbnails({ items, isAr }) {
  const preview = (items || []).slice(0, 4);
  const extra = Math.max(0, (items?.length || 0) - 4);

  if (!preview.length) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Package className="h-6 w-6" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center -space-x-2 rtl:space-x-reverse">
      {preview.map((item, i) => (
        <div
          key={`${item.productId || item.product || i}-${i}`}
          className="relative h-12 w-12 overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm"
          style={{ zIndex: preview.length - i }}
        >
          <ProductImage
            src={item.image}
            alt={isAr ? item.nameAr : (item.nameEn || item.nameAr)}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white bg-slate-100 text-xs font-bold text-slate-600 shadow-sm"
          style={{ zIndex: 0 }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

/** Full journey line — sits below order summary so users can track without opening details. */
function OrderCardTracking({ order, isAr }) {
  const [showTracking, setShowTracking] = useState(false);
  const { settings } = useStoreSettings();
  const status = order.orderStatus || order.status;
  const active = isOrderActive(status);
  const showTrackDelivery = canTrackOrder(order, settings);

  return (
    <section
      className={[
        'border-t border-border px-4 py-4 sm:px-5',
        active ? 'bg-gradient-to-b from-primary-50/90 to-white' : 'bg-slate-50/60',
      ].join(' ')}
      aria-label={isAr ? 'مسار الطلب' : 'Order tracking'}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-800">
            {isAr ? 'تتبع الطلب' : 'Track order'}
          </p>
          {active && (
            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-[10px] font-semibold text-primary-800">
              {isAr ? 'مباشر' : 'Live'}
            </span>
          )}
        </div>
        {showTrackDelivery && (
          <Button
            type="button"
            size="sm"
            variant={showTracking ? 'secondary' : 'primary'}
            onClick={() => setShowTracking((prev) => !prev)}
          >
            <MapPin className="h-4 w-4" />
            {showTracking
              ? (isAr ? 'إخفاء الخريطة' : 'Hide map')
              : (isAr ? 'تتبع التوصيل' : 'Track delivery')}
          </Button>
        )}
      </div>
      <OrderProgressLine order={order} isAr={isAr} compact />
      {showTrackDelivery && (
        <OrderTrackingPanel
          orderId={order._id}
          isAr={isAr}
          open={showTracking}
          onClose={() => setShowTracking(false)}
        />
      )}
    </section>
  );
}

export default function OrderCard({ order, isAr }) {
  const status = order.orderStatus || order.status;
  const itemCount = order.items?.length || 0;
  const displayNumber = formatOrderNumber(order.orderNumber);
  const locale = isAr ? 'ar-EG' : 'en-US';
  const firstItem = order.items?.[0];
  const summaryName = firstItem
    ? (isAr ? firstItem.nameAr : (firstItem.nameEn || firstItem.nameAr))
    : null;
  const canEdit = canCustomerEditOrder(order);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
      <Link
        to={`/orders/${order._id}`}
        onClick={() => scrollToTop('instant')}
        className="group block active:scale-[0.995]"
      >
        <div className="flex gap-4 p-4 sm:p-5">
          <OrderThumbnails items={order.items} isAr={isAr} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {isAr ? 'رقم الطلب' : 'Order'}
                </p>
                <p className="font-mono text-lg font-bold tracking-tight text-text tabular-nums sm:text-xl">{displayNumber}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusColor(status)}`}
              >
                {getOrderStatusLabel(status, isAr)}
              </span>
            </div>

            <p className="mt-1.5 line-clamp-1 text-sm text-text-muted">
              {summaryName}
              {itemCount > 1 && (
                <span className="text-text-muted/80">
                  {isAr ? ` · +${itemCount - 1} منتج` : ` · +${itemCount - 1} items`}
                </span>
              )}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <time dateTime={order.createdAt}>{formatDate(order.createdAt, locale)}</time>
              <span aria-hidden>·</span>
              <span>{formatRelativeTime(order.createdAt, isAr)}</span>
              {itemCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {itemCount}{' '}
                    {isAr ? (itemCount === 1 ? 'منتج' : 'منتجات') : (itemCount === 1 ? 'item' : 'items')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>

      <OrderCardTracking order={order} isAr={isAr} />

      {canEdit && (
        <div className="border-t border-sky-200/80 bg-sky-50/70 px-4 py-2.5 sm:px-5">
          <p className="flex items-center gap-2 text-xs font-medium leading-relaxed text-sky-900">
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {isAr
              ? 'يمكنك تعديل المنتجات والكميات قبل خروج الطلب للتوصيل'
              : 'You can edit items and quantities before delivery starts'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border bg-slate-50/80 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-text-muted">{isAr ? 'الإجمالي' : 'Total'}</p>
          <p className="text-lg font-bold text-primary-800 tabular-nums">{formatPrice(order.total)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <Link
              to={`/orders/${order._id}?edit=1`}
              onClick={() => scrollToTop('instant')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {isAr ? 'تعديل الطلب' : 'Edit order'}
            </Link>
          )}
          <Link
            to={`/orders/${order._id}`}
            onClick={() => scrollToTop('instant')}
            className="group inline-flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 hover:text-primary-800"
          >
            {isAr ? 'التفاصيل' : 'Details'}
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
