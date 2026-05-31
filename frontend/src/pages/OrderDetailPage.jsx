import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { orderService } from '../services/apiServices';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatPrice, formatDate } from '../utils/formatters';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils/orderStatus';
import OrderTimeline from '../components/order/OrderTimeline';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

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
  const { language } = useLanguage();
  const { addItem } = useCart();
  const isAr = language === 'ar';

  const { data: order, loading, error } = useAsyncData(async () => {
    const { data: res } = await orderService.getById(id);
    return res.order;
  }, [id]);

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

  if (loading) {
    return (
      <div className="container-app flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

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

  return (
    <div className="container-app py-8">
      <Link to="/orders" className="mb-6 inline-block text-sm text-primary-600 hover:underline">
        ← {isAr ? 'طلباتي' : 'My Orders'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {formatDate(order.createdAt, isAr ? 'ar-EG' : 'en-US')}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusColor(status)}`}>
          {getOrderStatusLabel(status, isAr)}
        </span>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">{isAr ? 'حالة الطلب' : 'Order status'}</h2>
        <OrderTimeline order={order} isAr={isAr} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">{isAr ? 'المنتجات' : 'Items'}</h2>
          <ul className="space-y-4">
            {order.items?.map((item, i) => (
              <li key={i} className="flex gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
                {item.image && (item.image.startsWith('http') || item.image.startsWith('/')) ? (
                  <img src={item.image} alt="" className="h-16 w-16 rounded-xl object-contain bg-slate-50" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50 text-2xl">
                    {item.image || '🛍️'}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{isAr ? item.nameAr : (item.nameEn || item.nameAr)}</p>
                  <p className="text-sm text-text-muted">
                    {formatPrice(item.price)} × {item.quantity}
                    {item.unit ? ` · ${item.unit}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-primary-700 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'عنوان التوصيل' : 'Delivery address'}</h2>
            <p className="text-sm text-text leading-relaxed">{formatAddress(order.shippingAddress, isAr)}</p>
            {order.phone && (
              <p className="mt-2 text-sm text-text-muted">
                {isAr ? 'الهاتف: ' : 'Phone: '}{order.phone}
              </p>
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
              {order.paymentMethod === 'stripe' ? (isAr ? 'بطاقة' : 'Card') : (isAr ? 'عند الاستلام' : 'Cash on delivery')}
            </p>
          </section>

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
