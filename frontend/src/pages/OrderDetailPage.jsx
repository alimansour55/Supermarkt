import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, MapPin, Pencil, XCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { orderService } from '../services/apiServices';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatPrice, formatDate } from '../utils/formatters';
import { formatOrderNumber } from '../utils/orderNumber';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils/orderStatus';
import { getDeliveryFailureReason } from '../constants/deliveryFailureReasons';
import OrderTimeline from '../components/order/OrderTimeline';
import OrderChat from '../components/order/OrderChat';
import OrderSubstitutions from '../components/order/OrderSubstitutions';
import OrderReturnsSection from '../components/order/OrderReturnsSection';
import Button from '../components/ui/Button';
import ProductImage from '../components/ui/ProductImage';
import { PageContentSkeleton } from '../components/ui/Skeleton';
import ProductReviewForm from '../components/product/ProductReviewForm';
import { downloadBlob } from '../admin/utils/downloadBlob';
import { useAuth } from '../context/AuthContext';
import OrderEditPanel from '../components/order/OrderEditPanel';
import OrderTrackingPanel from '../components/order/OrderTrackingPanel';
import { canTrackOrder } from '../utils/orderTracking';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { canCustomerEditOrder, getOrderEditBlockReason } from '../utils/orderEditHelpers';
import { useOrderChat } from '../hooks/useOrderChat';
import { getPaymentMethodLabel, requiresPaymentProof } from '../constants/paymentMethods';
import { scrollToTop, scrollToSection } from '../utils/scrollToTop';

const fetchOrderMessages = async (orderId) => {
  const { data } = await orderService.getMessages(orderId);
  return data.messages;
};

function formatAddress(addr, isAr) {
  if (!addr) return '—';
  const parts = [
    addr.street,
    addr.building && (isAr ? `مبنى ${addr.building}` : `Bldg ${addr.building}`),
    addr.floor && (isAr ? `طابق ${addr.floor}` : `Floor ${addr.floor}`),
    addr.area,
    addr.city,
    addr.governorate,
  ].filter(Boolean);
  return parts.join(isAr ? '، ' : ', ') || '—';
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { settings } = useStoreSettings();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const isAr = language === 'ar';
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const scrollToReturnsAfterLoad = useRef(false);

  const { data: order, loading, error, refetch } = useAsyncData(async () => {
    const { data: res } = await orderService.getById(id);
    return res.order;
  }, [id]);

  const fetchMessages = useCallback(
    () => fetchOrderMessages(id),
    [id],
  );

  const sendChatMessage = useCallback(async (payload) => {
    const { data } = await orderService.addMessage(id, payload);
    return data.order.messages;
  }, [id]);

  const {
    messages: chatMessages,
    sending: chatSending,
    send: handleMessage,
  } = useOrderChat({
    orderId: id,
    initialMessages: order?.messages || [],
    fetchMessages,
    sendMessageFn: sendChatMessage,
    enabled: Boolean(order?._id) && !loading,
  });

  useEffect(() => {
    scrollToReturnsAfterLoad.current = false;
    scrollToTop('instant');
  }, [id]);

  useEffect(() => {
    if (loading || !order) return;
    if (searchParams.get('edit') !== '1') return;
    if (canCustomerEditOrder(order)) {
      setShowEdit(true);
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('edit');
      return next;
    }, { replace: true });
  }, [loading, order, searchParams, setSearchParams]);

  useEffect(() => {
    if (loading || !order) return;
    if (searchParams.get('track') !== '1') return;
    setShowTracking(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('track');
      return next;
    }, { replace: true });
    requestAnimationFrame(() => {
      scrollToSection('order-tracking-section', 'smooth');
    });
  }, [loading, order, searchParams, setSearchParams]);

  useEffect(() => {
    if (!loading && order && scrollToReturnsAfterLoad.current) {
      scrollToReturnsAfterLoad.current = false;
      scrollToSection('order-returns-section', 'smooth');
    }
  }, [loading, order]);

  const handleReorder = () => {
    if (!order?.items?.length) return;
    order.items.forEach((item) => {
      const productId = item.product?._id || item.product;
      addItem(
        {
          _id: productId,
          productId,
          name: item.nameAr,
          nameEn: item.nameEn,
          price: item.price,
          image: item.image,
          emoji: item.image,
          unit: item.unit,
        },
        item.quantity,
        false,
      );
    });
    navigate('/cart');
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await orderService.cancel(id, { reason: cancelReason });
      setShowCancel(false);
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubstitution = async (subId, action) => {
    setActionLoading(true);
    try {
      await orderService.respondSubstitution(id, subId, { action });
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnRequest = async (payload) => {
    setActionLoading(true);
    try {
      await orderService.requestReturn(id, payload);
      scrollToReturnsAfterLoad.current = true;
      refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    const res = await orderService.downloadInvoice(id, isAr ? 'ar' : 'en');
    downloadBlob(res.data, `invoice-${order.orderNumber}.pdf`);
  };

  if (loading) return <PageContentSkeleton />;

  if (error || !order) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'الطلب غير موجود' : 'Order not found'}</p>
        <Link to="/orders" className="mt-4 inline-block text-primary-600">
          {isAr ? 'العودة للطلبات' : 'Back to orders'}
        </Link>
      </div>
    );
  }

  const status = order.orderStatus || order.status;
  const canCancel = ['pending', 'confirmed', 'preparing'].includes(status);
  const canEdit = canCustomerEditOrder(order);
  const isDelivered = status === 'delivered';
  const showReviewPendingHint = !isDelivered && status !== 'cancelled';
  const canReviewItems = isDelivered;
  const editBlockReason = getOrderEditBlockReason(order, isAr);
  const showTrackDelivery = canTrackOrder(order, settings);

  return (
    <div className="container-app py-8">
      <Link to="/orders" className="mb-6 inline-block text-sm text-primary-600 hover:underline">
        ← {isAr ? 'طلباتي' : 'My Orders'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {isAr ? 'رقم الطلب' : 'Order number'}
          </p>
          <h1 className="font-mono text-2xl font-bold tabular-nums md:text-3xl">
            {formatOrderNumber(order.orderNumber)}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {formatDate(order.createdAt, isAr ? 'ar-EG' : 'en-US')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusColor(status)}`}>
            {getOrderStatusLabel(status, isAr)}
          </span>
          <Button size="sm" variant="secondary" onClick={handleDownloadInvoice}>
            <Download className="h-4 w-4" />
            {isAr ? 'فاتورة PDF' : 'Invoice PDF'}
          </Button>
        </div>
      </div>

      {order.assignedDriver && (
        <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
          {isAr ? 'مندوب التوصيل:' : 'Delivery driver:'}{' '}
          <strong>{order.assignedDriver.name}</strong>
        </p>
      )}

      {status === 'delivery_failed' && getDeliveryFailureReason(order, isAr) && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-red-900"
        >
          <p className="font-bold">{isAr ? 'تعذّر تسليم طلبك' : 'Delivery could not be completed'}</p>
          <p className="mt-2 text-sm leading-relaxed">
            <span className="font-semibold">{isAr ? 'السبب: ' : 'Reason: '}</span>
            {getDeliveryFailureReason(order, isAr)}
          </p>
          <p className="mt-2 text-xs text-red-800/90">
            {isAr
              ? 'يمكنك التواصل معنا عبر الرسائل أدناه وسنعيد جدولة التوصيل أو نساعدك.'
              : 'Contact us using the messages below and we will help reschedule or resolve the issue.'}
          </p>
        </div>
      )}

      <OrderSubstitutions
        substitutions={order.substitutions || []}
        isAr={isAr}
        onRespond={handleSubstitution}
        responding={actionLoading}
      />

      {showEdit && canEdit && (
        <div className="mt-6">
          <OrderEditPanel
            order={order}
            isAr={isAr}
            onClose={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              refetch();
            }}
          />
        </div>
      )}

      {!showEdit && canEdit && (
        <div className="mt-6">
          <Button type="button" variant="secondary" onClick={() => setShowEdit(true)} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4" />
            {isAr ? 'تعديل الطلب' : 'Edit order'}
          </Button>
        </div>
      )}

      {!canEdit && ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(status) && editBlockReason && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {editBlockReason}
        </p>
      )}

      <section id="order-tracking-section" className="mt-8 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-bold">{isAr ? 'تتبع طلبك' : 'Track your order'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? '٤ مراحل من الاستلام حتى التسليم' : '4 steps from receipt to delivery'}
            </p>
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
        <OrderTimeline order={order} isAr={isAr} />
        {showTrackDelivery && (
          <OrderTrackingPanel
            orderId={order._id}
            isAr={isAr}
            open={showTracking}
            onClose={() => setShowTracking(false)}
          />
        )}
      </section>

      <div className="mt-6">
        <OrderReturnsSection
          order={order}
          isAr={isAr}
          submitting={actionLoading}
          onRequestReturn={handleReturnRequest}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">{isAr ? 'رسائل الطلب' : 'Order messages'}</h2>
        <OrderChat
          messages={chatMessages}
          isAr={isAr}
          sending={chatSending}
          onSend={handleMessage}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-1 text-lg font-bold">{isAr ? 'المنتجات' : 'Items'}</h2>
          {canReviewItems && (
            <p className="mb-4 text-sm text-text-muted">
              {isAr ? 'يمكنك تقييم المنتجات مرة واحدة بعد التسليم ⭐' : 'Rate each product once after delivery ⭐'}
            </p>
          )}
          {showReviewPendingHint && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {isAr
                ? 'التقييم متاح بعد تغيير حالة الطلب إلى «تم التسليم».'
                : 'Product ratings unlock when this order is marked as delivered.'}
            </p>
          )}
          <ul className="space-y-4">
            {order.items?.map((item, i) => {
              const productId = item.productId || item.product?._id || item.product;
              return (
              <li key={i} className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <ProductImage
                    src={item.image}
                    alt=""
                    className="h-full w-full"
                    imgClassName="h-full w-full object-contain p-1"
                    placeholderClassName="scale-75"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {isAr ? item.nameAr : (item.nameEn || item.nameAr)}
                    {item.substituted && (
                      <span className="ms-2 text-xs text-amber-700">{isAr ? '(بديل)' : '(substituted)'}</span>
                    )}
                  </p>
                  <p className="text-sm text-text-muted">
                    {formatPrice(item.price)} × {item.quantity}
                    {item.unit ? ` · ${item.unit}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-primary-700 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>
                </div>
                {canReviewItems && productId && (
                  <ProductReviewForm
                    productId={productId}
                    orderId={order._id}
                    isAr={isAr}
                    isAuthenticated={isAuthenticated}
                    showOnOrder
                    compact
                  />
                )}
              </li>
            );})}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'عنوان التوصيل' : 'Delivery address'}</h2>
            <p className="text-sm text-text leading-relaxed">{formatAddress(order.shippingAddress, isAr)}</p>
            {order.phone && (
              <p className="mt-2 text-sm text-text-muted">
                {isAr ? 'الهاتف: ' : 'Phone: '}
                <span dir="ltr">{order.phone}</span>
              </p>
            )}
            {order.alternatePhone && (
              <p className="mt-1 text-sm text-text-muted">
                {isAr ? 'هاتف بديل: ' : 'Alternate phone: '}
                <span dir="ltr">{order.alternatePhone}</span>
              </p>
            )}
            {order.shippingAddress?.formattedAddress && (
              <p className="mt-2 text-xs text-text-muted">{order.shippingAddress.formattedAddress}</p>
            )}
            {order.shippingAddress?.lat != null && order.shippingAddress?.lng != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${order.shippingAddress.lat},${order.shippingAddress.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" />
                {isAr ? 'عرض الموقع على الخريطة' : 'View location on map'}
              </a>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'ملخص الدفع' : 'Payment summary'}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">{isAr ? 'التوصيل' : 'Delivery'}</dt>
                  <dd>{formatPrice(order.deliveryFee)}</dd>
                </div>
              )}
              {(order.discount || order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>{isAr ? 'خصم' : 'Discount'}</dt>
                  <dd>-{formatPrice(order.discount || order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt>{isAr ? 'الإجمالي' : 'Total'}</dt>
                <dd className="text-primary-700">{formatPrice(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              {isAr ? 'طريقة الدفع: ' : 'Payment: '}
              {getPaymentMethodLabel(order.paymentMethod, settings, isAr)}
              {requiresPaymentProof(order.paymentMethod) && order.paymentStatus === 'pending' && (
                <span className="mt-1 block text-amber-700">
                  {isAr ? 'بانتظار تأكيد التحويل من المتجر' : 'Waiting for store to confirm your transfer'}
                </span>
              )}
            </p>
            {order.paymentProofUrl && (
              <a
                href={order.paymentProofUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-primary-700 hover:text-primary-800"
              >
                {isAr ? 'عرض صورة الإيصال' : 'View receipt photo'}
              </a>
            )}
          </section>

          {canCancel && !showCancel && (
            <Button type="button" variant="danger" onClick={() => setShowCancel(true)} className="w-full">
              <XCircle className="h-4 w-4" />
              {isAr ? 'إلغاء الطلب' : 'Cancel order'}
            </Button>
          )}

          {showCancel && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={isAr ? 'سبب الإلغاء (اختياري)' : 'Reason (optional)'}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button variant="danger" disabled={actionLoading} onClick={handleCancel} className="flex-1">
                  {isAr ? 'تأكيد الإلغاء' : 'Confirm cancel'}
                </Button>
                <Button variant="secondary" onClick={() => setShowCancel(false)}>{isAr ? 'تراجع' : 'Back'}</Button>
              </div>
            </div>
          )}

          {status !== 'cancelled' && (
            <Button type="button" onClick={handleReorder} size="lg" className="w-full">
              {isAr ? 'إعادة الطلب' : 'Reorder'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
