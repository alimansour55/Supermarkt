import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { calculateCartTotals, validateCoupon } from '../utils/cartCalculations.js';
import { calculateItemsSubtotal } from '../utils/cartLinePricing.js';
import { formatCartItem } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { normalizeVariantId } from '../utils/productCatalog.js';
import { checkLineStock, syncInventoryReservations } from '../services/inventoryReservation.service.js';
import {
  resolveRequestLang,
  formatInsufficientStockMessage,
  formatGenericInsufficientStock,
} from '../utils/stockMessages.js';

const throwIfInsufficientStock = (stockCheck, lang) => {
  if (!stockCheck.ok) {
    throw new AppError(
      stockCheck.line
        ? formatInsufficientStockMessage(stockCheck.line, lang)
        : (stockCheck.message || formatGenericInsufficientStock(lang)),
      400,
    );
  }
};

const populateCart = (query) => query.populate({
  path: 'items.product',
  select: [
    'nameAr nameEn slug price wholesalePrice emoji unit stock reservedStock variants sku barcode images isActive',
    'oldPrice discount isOffer offerActive activePromotionId promotionType offerBadgeAr offerBadgeEn promotionBuyQty promotionGetQty promotionUnit promotionSecondPercentOff promotionCartLineAr promotionCartLineEn promotionCartProgressAr promotionCartProgressEn promotionCartSubtextAr promotionCartSubtextEn',
  ].join(' '),
});

const cartItemMatch = (item, productId, variantId) =>
  item.product.toString() === productId
  && (item.variantId?.toString() || '') === (variantId || '');

const resolveCartItems = async (rawItems = []) => {
  const resolved = [];

  for (const item of rawItems) {
    const productId = item.product || item.productId;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) continue;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) continue;

    const variantId = normalizeVariantId(item.variantId);
    const qty = Math.max(1, item.quantity || 1);

    const existing = resolved.find((r) =>
      r.product.toString() === product._id.toString()
      && (r.variantId?.toString() || '') === (variantId?.toString() || ''),
    );

    const requestedQty = (existing?.quantity || 0) + qty;
    const stockCheck = await checkLineStock(product, variantId, requestedQty);
    const finalQty = stockCheck.ok ? requestedQty : (stockCheck.available || 0);
    if (finalQty < 1) continue;

    if (existing) {
      existing.quantity = finalQty;
    } else {
      resolved.push({
        product: product._id,
        variantId: variantId || undefined,
        quantity: finalQty,
      });
    }
  }

  return resolved;
};

const formatCartResponse = async (cart, { discountCode = null, deliveryMethod = 'scheduled', deliveryZoneId = null } = {}) => {
  const populated = await populateCart(Cart.findById(cart._id));
  const items = populated.items.map(formatCartItem).filter(Boolean);

  const totals = await calculateCartTotals({ items, deliveryMethod, discountCode, deliveryZoneId });

  return {
    items,
    discountCode,
    deliveryMethod,
    ...totals,
  };
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId, quantity = 1, discountCode, deliveryMethod = 'scheduled' } = req.body;
  const lang = resolveRequestLang(req.body);

  if (!productId) throw new AppError('productId is required', 400);
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new AppError('Invalid product ID', 400);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found', 404);

  const vid = normalizeVariantId(variantId);
  const qty = Math.max(1, Number(quantity));
  const stockCheck = await checkLineStock(product, vid, qty, req.user._id, lang);
  throwIfInsufficientStock(stockCheck, lang);

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((item) => cartItemMatch(item, productId, vid));

  if (existing) {
    const nextQty = existing.quantity + qty;
    const again = await checkLineStock(product, vid, nextQty, req.user._id, lang);
    throwIfInsufficientStock(again, lang);
    existing.quantity = nextQty;
  } else {
    cart.items.push({ product: productId, variantId: vid || undefined, quantity: qty });
  }

  await cart.save();

  res.status(201).json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, variantId, quantity, discountCode, deliveryMethod = 'scheduled' } = req.body;
  const lang = resolveRequestLang(req.body);

  if (!productId) throw new AppError('productId is required', 400);
  if (quantity == null || quantity < 1) throw new AppError('quantity must be at least 1', 400);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found', 404);

  const vid = normalizeVariantId(variantId);
  const stockCheck = await checkLineStock(product, vid, Number(quantity), req.user._id, lang);
  throwIfInsufficientStock(stockCheck, lang);

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => cartItemMatch(i, productId, vid));

  if (!item) throw new AppError('Item not in cart', 404);

  item.quantity = Number(quantity);
  await cart.save();

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { variantId, discountCode, deliveryMethod = 'scheduled' } = req.query;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found', 404);

  const vid = normalizeVariantId(variantId);
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => !cartItemMatch(item, productId, vid));

  if (cart.items.length === before) {
    throw new AppError('Item not in cart', 404);
  }

  await cart.save();

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const getCart = asyncHandler(async (req, res) => {
  const { discountCode, deliveryMethod = 'scheduled', deliveryZoneId = null } = req.query;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod, deliveryZoneId }),
  });
});

export const syncCart = asyncHandler(async (req, res) => {
  const {
    items,
    discountCode,
    deliveryMethod = 'scheduled',
    deliveryZoneId = null,
    reserve = false,
  } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({ user: req.user._id });
  }

  if (Array.isArray(items)) {
    cart.items = await resolveCartItems(items);
  }

  await cart.save();

  if (reserve && cart.items.length) {
    const populated = await formatCartResponse(cart, { discountCode, deliveryMethod, deliveryZoneId });
    await syncInventoryReservations(req.user._id, populated.items);
  }

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod, deliveryZoneId }),
  });
});

export const mergeCart = asyncHandler(async (req, res) => {
  const {
    guestItems = [],
    discountCode,
    deliveryMethod = 'scheduled',
    deliveryZoneId = null,
  } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const currentItems = cart.items.map((i) => ({
    productId: i.product.toString(),
    variantId: i.variantId?.toString(),
    quantity: i.quantity,
  }));

  const mergedMap = new Map();

  [...currentItems, ...guestItems].forEach((item) => {
    const id = (item.productId || item.product)?.toString();
    if (!id) return;
    const key = `${id}:${item.variantId || ''}`;
    mergedMap.set(key, {
      productId: id,
      variantId: item.variantId,
      quantity: (mergedMap.get(key)?.quantity || 0) + (item.quantity || 1),
    });
  });

  cart.items = await resolveCartItems([...mergedMap.values()]);

  await cart.save();

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod, deliveryZoneId }),
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (cart) {
    cart.items = [];
    await cart.save();
  }

  res.json({
    success: true,
    cart: { items: [], subtotal: 0, deliveryFee: 0, discountAmount: 0, discount: 0, total: 0 },
  });
});

export const applyDiscount = asyncHandler(async (req, res) => {
  const {
    code,
    deliveryMethod = 'scheduled',
    deliveryZoneId = null,
    subtotal: clientSubtotal,
    items: clientItems,
  } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  if (Array.isArray(clientItems) && clientItems.length) {
    cart.items = await resolveCartItems(clientItems);
    await cart.save();
  }

  const populated = await populateCart(Cart.findById(cart._id));
  const items = populated.items.map(formatCartItem).filter(Boolean);
  const serverSubtotal = calculateItemsSubtotal(items);
  const subtotal = Number.isFinite(Number(clientSubtotal)) && Number(clientSubtotal) > 0
    ? Math.max(serverSubtotal, Number(clientSubtotal))
    : serverSubtotal;
  const validation = await validateCoupon(code, subtotal);

  if (!validation.valid) {
    throw new AppError(validation.message, 400);
  }

  res.json({
    success: true,
    cart: await formatCartResponse(cart, {
      discountCode: validation.coupon.code,
      deliveryMethod,
      deliveryZoneId,
    }),
    coupon: validation.coupon,
  });
});

export const removeDiscount = asyncHandler(async (req, res) => {
  const { deliveryMethod = 'scheduled' } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });

  res.json({
    success: true,
    cart: cart
      ? await formatCartResponse(cart, { discountCode: null, deliveryMethod })
      : { items: [], subtotal: 0, deliveryFee: 0, discountAmount: 0, discount: 0, total: 0 },
  });
});
