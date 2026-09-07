import Order from '../models/Order.js';

/**
 * Admin read state for customer messages on orders.
 */

export function countUnreadCustomerMessages(order) {
  const messages = order.messages || [];
  const readAt = order.adminMessagesReadAt ? new Date(order.adminMessagesReadAt) : null;

  return messages.filter((m) => {
    if (m.authorRole !== 'customer' || m.isInternal) return false;
    const created = new Date(m.createdAt);
    return !readAt || created > readAt;
  }).length;
}

export function hasUnreadCustomerMessages(order) {
  return countUnreadCustomerMessages(order) > 0;
}

export async function markOrderMessagesReadByAdmin(order) {
  order.adminMessagesReadAt = new Date();
  await order.save();
}

export function getLastCustomerMessage(order) {
  const messages = (order.messages || []).filter(
    (m) => m.authorRole === 'customer' && !m.isInternal,
  );
  if (!messages.length) return null;
  return messages.reduce((latest, m) => {
    if (!latest) return m;
    return new Date(m.createdAt) > new Date(latest.createdAt) ? m : latest;
  }, null);
}

export function formatOrderChatListItem(order) {
  const last = getLastCustomerMessage(order);
  const unread = countUnreadCustomerMessages(order);
  const user = order.user;

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    phone: order.phone,
    user: user
      ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        }
      : null,
    unreadCustomerMessages: unread,
    lastMessage: last
      ? {
          body: last.body,
          createdAt: last.createdAt,
          authorName: last.authorName,
        }
      : null,
  };
}

export async function countOrdersWithUnreadCustomerMessages() {
  const [result] = await Order.aggregate([
    {
      $addFields: {
        unreadCustomerMessages: {
          $size: {
            $filter: {
              input: { $ifNull: ['$messages', []] },
              as: 'm',
              cond: {
                $and: [
                  { $eq: ['$$m.authorRole', 'customer'] },
                  { $ne: ['$$m.isInternal', true] },
                  {
                    $or: [
                      { $eq: ['$adminMessagesReadAt', null] },
                      { $gt: ['$$m.createdAt', '$adminMessagesReadAt'] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    { $match: { unreadCustomerMessages: { $gt: 0 } } },
    { $count: 'total' },
  ]);
  return result?.total || 0;
}
