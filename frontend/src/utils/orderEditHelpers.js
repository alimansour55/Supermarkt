/** Customer order edit — locked once status is out_for_delivery or later. */

const EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'preparing']);

export function canCustomerEditOrder(order) {
  if (!order) return false;
  const status = order.orderStatus || order.status;
  if (!EDITABLE_STATUSES.has(status)) return false;
  if (order.paymentStatus === 'paid') return false;
  if ((order.substitutions || []).some((sub) => sub.status === 'pending')) return false;
  return order.canEdit !== false;
}

export function getOrderEditBlockReason(order, isAr = true) {
  if (order?.canEditReason && isAr) return order.canEditReason;
  if (order?.canEditReasonEn && !isAr) return order.canEditReasonEn;

  const status = order?.orderStatus || order?.status;
  if (status === 'out_for_delivery') {
    return isAr
      ? 'الطلب في الطريق إليك ولا يمكن تعديله'
      : 'This order is out for delivery and cannot be edited';
  }
  if (status === 'cancelled') {
    return isAr ? 'الطلب ملغي' : 'Order is cancelled';
  }
  if (['delivered', 'delivery_failed', 'returned'].includes(status)) {
    return isAr ? 'تم إغلاق هذا الطلب' : 'This order is closed';
  }
  if (order?.paymentStatus === 'paid') {
    return isAr ? 'تم الدفع الإلكتروني — تواصل معنا للتعديل' : 'Paid online — contact us to edit';
  }
  if ((order?.substitutions || []).some((sub) => sub.status === 'pending')) {
    return isAr ? 'يرجى الرد على اقتراح البديل أولاً' : 'Respond to the substitution suggestion first';
  }
  return isAr ? 'لا يمكن تعديل هذا الطلب' : 'This order cannot be edited';
}

export function orderItemKey(item) {
  const productId = item.productId || item.product?._id || item.product;
  const variantId = item.variantId || '';
  return `${productId}:${variantId}`;
}

export function mapOrderItemsToEditPayload(items = []) {
  return items.map((item) => ({
    productId: item.productId || item.product?._id || item.product,
    variantId: item.variantId || null,
    quantity: item.quantity,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    price: item.price,
    image: item.image,
    unit: item.unit,
  }));
}
