import Banner from '../models/Banner.js';
import { AppError } from '../utils/AppError.js';
import {
  uploadFileToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const parseOptionalBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const parseOptionalNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const getPublicBanners = asyncHandler(async (req, res) => {
  const { placement } = req.query;
  const filter = { isActive: true };
  if (placement) filter.placement = placement;

  const banners = await Banner.find(filter).sort({ sortOrder: 1 });
  res.json({ success: true, data: banners });
});

export const getAdminBanners = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 });
  res.json({ success: true, data: banners });
});

export const createBanner = asyncHandler(async (req, res) => {
  const payload = {
    titleAr: req.body.titleAr,
    titleEn: req.body.titleEn,
    subtitleAr: req.body.subtitleAr,
    subtitleEn: req.body.subtitleEn,
    link: req.body.link || '/offers',
    placement: req.body.placement || 'hero',
    sortOrder: parseOptionalNumber(req.body.sortOrder, 0),
    isActive: parseOptionalBoolean(req.body.isActive, true),
    image: req.body.image,
  };

  if (req.file) {
    try {
      const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.banners);
      payload.image = uploaded.url;
      payload.cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Image upload failed — configure Cloudinary or provide image URL', 400);
    }
  }

  if (!payload.image) throw new AppError('Banner image is required', 400);

  const banner = await Banner.create(payload);
  res.status(201).json({ success: true, data: banner });
});

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  if (req.file) {
    try {
      if (banner.cloudinaryPublicId) await deleteFromCloudinary(banner.cloudinaryPublicId);
      const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.banners);
      banner.image = uploaded.url;
      banner.cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Image upload failed', 400);
    }
  } else if (req.body.image !== undefined && req.body.image !== banner.image) {
    if (banner.cloudinaryPublicId) {
      await deleteFromCloudinary(banner.cloudinaryPublicId);
      banner.cloudinaryPublicId = null;
    }
    banner.image = req.body.image;
  }

  if (req.body.titleAr !== undefined) banner.titleAr = req.body.titleAr;
  if (req.body.titleEn !== undefined) banner.titleEn = req.body.titleEn;
  if (req.body.subtitleAr !== undefined) banner.subtitleAr = req.body.subtitleAr;
  if (req.body.subtitleEn !== undefined) banner.subtitleEn = req.body.subtitleEn;
  if (req.body.link !== undefined) banner.link = req.body.link;
  if (req.body.placement !== undefined) banner.placement = req.body.placement;
  if (req.body.sortOrder !== undefined) banner.sortOrder = parseOptionalNumber(req.body.sortOrder, banner.sortOrder);
  if (req.body.isActive !== undefined) banner.isActive = parseOptionalBoolean(req.body.isActive, banner.isActive);

  await banner.save();

  res.json({ success: true, data: banner });
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  if (banner.cloudinaryPublicId) await deleteFromCloudinary(banner.cloudinaryPublicId);
  await banner.deleteOne();

  res.json({ success: true, message: 'Banner deleted' });
});
