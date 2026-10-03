import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { getStripe } from '../config/stripe.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { appReturnUrl, clientUrl } from '../config/payments.js';
import {
  applyFawryResult,
  applyPaymobResult,
  findOrderByPaymentReference,
  markOrderFailed,
  markOrderPaid,
  reconcileOrderPayment,
  startOnlinePayment,
} from '../services/payments/payment.service.js';
import {
  interpretPaymobTransaction,
  verifyPaymobCallback,
  verifyPaymobRedirect,
} from '../services/payments/paymob.service.js';
import { interpretFawryStatus, verifyFawryNotification } from '../services/payments/fawry.service.js';

const getStripeClient = () => {
  try {
    return getStripe();
  } catch {
    throw new AppError('Stripe is not configured', 503);
  }
};

const buildCheckoutLineItems = (order) => {
  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: 'egp',
      product_data: {
        name: item.nameEn || item.nameAr,
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  if (order.deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency: 'egp',
        product_data: { name: 'Delivery fee' },
        unit_amount: Math.round(order.deliveryFee * 100),
      },
      quantity: 1,
    });
  }

  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  );
  const expectedTotal = Math.round(order.total * 100);

  if ((order.discount > 0 || order.pointsDiscount > 0 || order.walletAmount > 0) && lineItemsTotal !== expectedTotal) {
    return [
      {
        price_data: {
          currency: 'egp',
          product_data: {
            name: `Order ${order.orderNumber}`,
            description: [
              `${order.items.length} item(s)`,
              order.couponCode ? `Coupon: ${order.couponCode}` : null,
              order.discount > 0 ? `Discount: ${order.discount} EGP` : null,
              order.pointsDiscount > 0 ? `Points: ${order.pointsDiscount} EGP` : null,
              order.walletAmount > 0 ? `Wallet: ${order.walletAmount} EGP` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          },
          unit_amount: expectedTotal,
        },
        quantity: 1,
      },
    ];
  }

  return lineItems;
};

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new AppError('orderId is required', 400);
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  if (order.paymentMethod !== 'stripe') {
    throw new AppError('This order is not configured for online payment', 400);
  }

  if (order.paymentStatus === 'paid') {
    throw new AppError('Order already paid', 400);
  }

  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: buildCheckoutLineItems(order),
    success_url: `${clientUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
    cancel_url: `${clientUrl()}/payment/failed?order_id=${order._id}`,
    metadata: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: req.user._id.toString(),
    },
    customer_email: req.user.email || `${req.user.phone.replace('+', '')}@sms.marketplus.local`,
  });

  order.stripeSessionId = session.id;
  order.paymentStatus = 'pending';
  await order.save();

  res.json({
    success: true,
    sessionId: session.id,
    url: session.url,
    orderId: order._id,
    orderNumber: order.orderNumber,
    total: order.total,
  });
});

export const verifyCheckoutSession = asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id || req.body.sessionId;
  const orderId = req.query.order_id || req.body.orderId;

  if (!sessionId || !orderId) {
    throw new AppError('session_id and order_id are required', 400);
  }

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  if (order.paymentStatus === 'paid') {
    return res.json({
      success: true,
      alreadyPaid: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        pointsEarned: order.pointsEarned || 0,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      },
    });
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.orderId !== order._id.toString()) {
    throw new AppError('Payment session does not match this order', 400);
  }

  if (session.payment_status === 'paid') {
    const updated = await markOrderPaid(order._id, { stripeSessionId: session.id });
    return res.json({
      success: true,
      order: {
        id: updated._id,
        orderNumber: updated.orderNumber,
        total: updated.total,
        pointsEarned: updated.pointsEarned || 0,
        paymentStatus: updated.paymentStatus,
        orderStatus: updated.orderStatus,
      },
    });
  }

  if (session.status === 'expired') {
    await markOrderFailed(order._id);
    throw new AppError('Payment session expired', 402);
  }

  res.json({
    success: false,
    status: session.status,
    paymentStatus: session.payment_status,
    message: 'Payment not completed yet',
  });
});

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  if (order.paymentStatus === 'paid') {
    throw new AppError('Order already paid', 400);
  }

  const stripe = getStripeClient();
  const amountInPiastres = Math.round(order.total * 100);

  let paymentIntent;
  if (order.stripeSessionId?.startsWith('pi_')) {
    paymentIntent = await stripe.paymentIntents.retrieve(order.stripeSessionId);
    if (paymentIntent.status === 'succeeded') {
      await markOrderPaid(order._id, { stripeSessionId: paymentIntent.id });
      return res.json({ success: true, clientSecret: null, alreadyPaid: true, orderNumber: order.orderNumber, total: order.total });
    }
  } else {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPiastres,
      currency: 'egp',
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      automatic_payment_methods: { enabled: true },
    });
    order.stripeSessionId = paymentIntent.id;
    await order.save();
  }

  res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    orderId: order._id,
    orderNumber: order.orderNumber,
    total: order.total,
  });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  if (order.paymentStatus === 'paid') {
    return res.json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: 'paid',
        orderStatus: order.orderStatus,
      },
    });
  }

  if (!order.stripeSessionId) {
    throw new AppError('No payment session for this order', 400);
  }

  const stripe = getStripeClient();

  if (order.stripeSessionId.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status === 'paid') {
      const updated = await markOrderPaid(order._id, { stripeSessionId: session.id });
      return res.json({
        success: true,
        order: {
          id: updated._id,
          orderNumber: updated.orderNumber,
          paymentStatus: 'paid',
          orderStatus: updated.orderStatus,
        },
      });
    }
    throw new AppError('Payment not completed', 402);
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripeSessionId);

  if (paymentIntent.status === 'succeeded') {
    const updated = await markOrderPaid(order._id, { stripeSessionId: paymentIntent.id });
    return res.json({
      success: true,
      order: {
        id: updated._id,
        orderNumber: updated.orderNumber,
        paymentStatus: 'paid',
        orderStatus: updated.orderStatus,
      },
    });
  }

  if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
    await markOrderFailed(order._id);
    throw new AppError('Payment failed', 402);
  }

  res.json({
    success: true,
    status: paymentIntent.status,
    requiresAction: paymentIntent.status === 'requires_action',
  });
});

const handleCheckoutSessionCompleted = async (session) => {
  const orderId = session.metadata?.orderId;
  if (!orderId || session.payment_status !== 'paid') return;
  await markOrderPaid(orderId, { stripeSessionId: session.id });
};

const handleCheckoutSessionFailed = async (session) => {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  await markOrderFailed(orderId);
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return;
  await markOrderPaid(orderId, { stripeSessionId: paymentIntent.id });
};

const handlePaymentIntentFailed = async (paymentIntent) => {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return;
  await markOrderFailed(orderId);
};

export const stripeWebhook = async (req, res) => {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return res.status(503).send('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret) {
      const signature = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(400).send('Webhook secret is required in production');
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        await handleCheckoutSessionFailed(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  res.json({ received: true });
};

// ── Paymob / Fawry ──────────────────────────────────────────────────────────

const orderSummary = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  total: order.total,
  pointsEarned: order.pointsEarned || 0,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
});

/** What the customer may see about the gateway attempt (no secrets, no internal ids). */
const paymentView = (order) => {
  const p = order.payment;
  if (!p) return null;
  return {
    provider: p.provider,
    fawryReferenceNumber: p.fawryReferenceNumber || null,
    expiresAt: p.provider === 'fawry' ? p.expiresAt : null,
    sourceType: p.sourceType || null,
    maskedPan: p.maskedPan || null,
    paidAt: p.paidAt || null,
  };
};

/** POST /payment/start { orderId, channel: 'web'|'app', lang } */
export const startPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new AppError('orderId is required', 400);
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);

  const result = await startOnlinePayment(order, req.user, {
    channel: req.body.channel === 'app' ? 'app' : 'web',
    lang: req.body.lang === 'en' ? 'en' : 'ar',
  });
  const fresh = await Order.findById(order._id);
  res.json({ success: true, ...result, order: orderSummary(fresh), payment: paymentView(fresh) });
});

/** GET /payment/status/:orderId — stored status, refreshed from the gateway while unpaid. */
export const getPaymentStatus = asyncHandler(async (req, res) => {
  let order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentStatus !== 'paid' && order.payment) {
    order = (await reconcileOrderPayment(order)) || order;
  }
  res.json({ success: true, order: orderSummary(order), payment: paymentView(order) });
});

/** POST /payment/paymob/webhook?hmac=… — Paymob "transaction processed" callback. */
export const paymobWebhook = async (req, res) => {
  try {
    const { obj, type } = req.body || {};
    if (type !== 'TRANSACTION' || !obj) return res.json({ received: true });
    if (!verifyPaymobCallback(obj, req.query.hmac)) {
      console.warn('[payments] Paymob webhook rejected: bad HMAC');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const tx = interpretPaymobTransaction(obj);
    const order = await findOrderByPaymentReference(tx.merchantOrderId);
    if (!order) {
      console.warn(`[payments] Paymob webhook for unknown reference ${tx.merchantOrderId}`);
      return res.json({ received: true });
    }
    await applyPaymobResult(order, tx, { source: 'webhook' });
    return res.json({ received: true });
  } catch (err) {
    console.error('[payments] Paymob webhook failed:', err.message);
    return res.status(500).json({ error: 'Processing failed' }); // Paymob retries
  }
};

/**
 * GET /payment/paymob/return/:channel/:lang — where Paymob sends the customer back.
 * Trusted only via a valid redirect HMAC or the inquiry API; then forwards the browser
 * to the storefront result page, or back into the mobile app via its deep link.
 */
export const paymobReturn = async (req, res) => {
  const channel = req.params.channel === 'app' ? 'app' : 'web';
  const lang = req.params.lang === 'en' ? 'en' : 'ar';
  let order = null;
  try {
    order = await findOrderByPaymentReference(req.query.merchant_order_id);
    if (order && order.paymentStatus !== 'paid') {
      order = verifyPaymobRedirect(req.query)
        ? await applyPaymobResult(order, interpretPaymobTransaction(req.query), { source: 'redirect' })
        : await reconcileOrderPayment(order, { transactionId: req.query.id });
    }
  } catch (err) {
    console.error('[payments] Paymob return handling failed:', err.message);
  }

  const params = new URLSearchParams();
  if (order) {
    params.set('order_id', String(order._id));
    params.set('status', order.paymentStatus);
  }
  const target = channel === 'app'
    ? `${appReturnUrl()}?${params}`
    : `${clientUrl()}/${lang}/payment/result?${params}`;
  res.redirect(302, target);
};

/** POST /payment/fawry/webhook — FawryPay Server Notification V2. */
export const fawryWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    if (!verifyFawryNotification(body)) {
      console.warn('[payments] Fawry webhook rejected: bad signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const order = await findOrderByPaymentReference(body.merchantRefNumber);
    if (!order) {
      console.warn(`[payments] Fawry webhook for unknown reference ${body.merchantRefNumber}`);
      return res.json({ received: true });
    }
    await applyFawryResult(order, {
      state: interpretFawryStatus(body.orderStatus),
      rawStatus: body.orderStatus,
      fawryRefNumber: body.fawryRefNumber,
      orderAmount: body.orderAmount,
    });
    return res.json({ received: true });
  } catch (err) {
    console.error('[payments] Fawry webhook failed:', err.message);
    return res.status(500).json({ error: 'Processing failed' });
  }
};
