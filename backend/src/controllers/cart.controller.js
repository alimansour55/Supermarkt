import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { calculateCartTotals, validateCoupon } from '../utils/cartCalculations.js';
import { formatCartItem } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const populateCart = (query) => query.populate({
  path: 'items.product',
  select: 'nameAr nameEn slug price emoji unit stock isActive',
});

const resolveCartItems = async (rawItems = []) => {
  const resolved = [];

  for (const item of rawItems) {
    const productId = item.product || item.productId;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) continue;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) continue;

    const existing = resolved.find((r) => r.product.toString() === product._id.toString());
    if (existing) {
      existing.quantity += Math.max(1, item.quantity || 1);
    } else {
      resolved.push({
        product: product._id,
        quantity: Math.max(1, item.quantity || 1),
      });
    }
  }

  return resolved;
};

const formatCartResponse = async (cart, { discountCode = null, deliveryMethod = 'scheduled' } = {}) => {
  const populated = await populateCart(Cart.findById(cart._id));
  const items = populated.items.map(formatCartItem).filter(Boolean);

  const totals = await calculateCartTotals({ items, deliveryMethod, discountCode });

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
  const { productId, quantity = 1, discountCode, deliveryMethod = 'scheduled' } = req.body;

  if (!productId) throw new AppError('productId is required', 400);
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new AppError('Invalid product ID', 400);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found', 404);

  const qty = Math.max(1, Number(quantity));
  if (product.stock < qty) throw new AppError('Insufficient stock', 400);

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((item) => item.product.toString() === productId);

  if (existing) {
    if (product.stock < existing.quantity + qty) {
      throw new AppError('Insufficient stock', 400);
    }
    existing.quantity += qty;
  } else {
    cart.items.push({ product: productId, quantity: qty });
  }

  await cart.save();

  res.status(201).json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity, discountCode, deliveryMethod = 'scheduled' } = req.body;

  if (!productId) throw new AppError('productId is required', 400);
  if (quantity == null || quantity < 1) throw new AppError('quantity must be at least 1', 400);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('Product not found', 404);
  if (product.stock < quantity) throw new AppError('Insufficient stock', 400);

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => i.product.toString() === productId);

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
  const { discountCode, deliveryMethod = 'scheduled' } = req.query;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new AppError('Cart not found', 404);

  const before = cart.items.length;
  cart.items = cart.items.filter((item) => item.product.toString() !== productId);

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
  const { discountCode, deliveryMethod = 'scheduled' } = req.query;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const syncCart = asyncHandler(async (req, res) => {
  const { items, discountCode, deliveryMethod = 'scheduled' } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({ user: req.user._id });
  }

  if (Array.isArray(items)) {
    cart.items = await resolveCartItems(items);
  }

  await cart.save();

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
  });
});

export const mergeCart = asyncHandler(async (req, res) => {
  const { guestItems = [], discountCode, deliveryMethod = 'scheduled' } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const currentItems = cart.items.map((i) => ({
    productId: i.product.toString(),
    quantity: i.quantity,
  }));

  const mergedMap = new Map();

  [...currentItems, ...guestItems].forEach((item) => {
    const id = (item.productId || item.product)?.toString();
    if (!id) return;
    mergedMap.set(id, (mergedMap.get(id) || 0) + (item.quantity || 1));
  });

  cart.items = await resolveCartItems(
    [...mergedMap.entries()].map(([productId, quantity]) => ({ productId, quantity })),
  );

  await cart.save();

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode, deliveryMethod }),
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
  const { code, deliveryMethod = 'scheduled' } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const populated = await populateCart(Cart.findById(cart._id));
  const items = populated.items.map(formatCartItem).filter(Boolean);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const validation = await validateCoupon(code, subtotal);

  if (!validation.valid) {
    throw new AppError(validation.message, 400);
  }

  res.json({
    success: true,
    cart: await formatCartResponse(cart, { discountCode: validation.coupon.code, deliveryMethod }),
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
