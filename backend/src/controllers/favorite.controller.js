import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';

const validProductIds = async (ids = []) => {
  const normalized = [...new Set(ids.map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (!normalized.length) return [];
  const products = await Product.find({ _id: { $in: normalized }, isActive: true }).select('_id');
  return products.map((product) => product._id);
};

const getFavoriteProducts = async (userId) => {
  const user = await User.findById(userId)
    .populate({
      path: 'favorites',
      match: { isActive: true },
      populate: { path: 'category', select: 'slug nameAr nameEn' },
    });

  const products = (user?.favorites || []).filter(Boolean);
  return {
    ids: products.map((product) => product._id.toString()),
    products: products.map(formatProduct),
  };
};

export const getFavorites = asyncHandler(async (req, res) => {
  const data = await getFavoriteProducts(req.user._id);
  res.json({ success: true, ...data });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product id', 400);
  }
  const product = await Product.findOne({ _id: productId, isActive: true }).select('_id');
  if (!product) throw new AppError('Product not found', 404);

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { favorites: product._id } });
  const data = await getFavoriteProducts(req.user._id);
  res.json({ success: true, ...data });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError('Invalid product id', 400);
  }
  await User.findByIdAndUpdate(req.user._id, { $pull: { favorites: productId } });
  const data = await getFavoriteProducts(req.user._id);
  res.json({ success: true, ...data });
});

export const mergeFavorites = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.productIds) ? req.body.productIds : [];
  const productIds = await validProductIds(ids);

  if (productIds.length) {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { favorites: { $each: productIds } } });
  }

  const data = await getFavoriteProducts(req.user._id);
  res.json({ success: true, ...data });
});
