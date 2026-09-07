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

const parseOptionalDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError('Invalid campaign date', 400);
  return date;
};

const uploadOptionalImage = async ({ file, currentPublicId }) => {
  if (!file) return null;
  try {
    if (currentPublicId) await deleteFromCloudinary(currentPublicId);
    return uploadFileToCloudinary(file, CLOUDINARY_FOLDERS.banners);
  } catch {
    throw new AppError('Image upload failed — configure Cloudinary or provide image URL', 400);
  }
};

const setExternalImage = async ({ doc, urlField, publicIdField, nextUrl }) => {
  if (nextUrl === undefined || nextUrl === doc[urlField]) return;
  if (doc[publicIdField]) {
    await deleteFromCloudinary(doc[publicIdField]);
    doc[publicIdField] = '';
  }
  doc[urlField] = nextUrl || '';
};

const normalizeBannerLink = (link) => {
  if (!link || typeof link !== 'string') return '/offers';
  let s = link.trim();
  if (!s) return '/offers';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+$/, '') || s;
};

const buildBannerPayload = (body) => ({
  titleAr: body.titleAr,
  titleEn: body.titleEn,
  subtitleAr: body.subtitleAr,
  subtitleEn: body.subtitleEn,
  link: normalizeBannerLink(body.link),
  ctaAr: body.ctaAr || 'تسوق الآن',
  ctaEn: body.ctaEn || 'Shop Now',
  placement: body.placement || 'hero',
  targetAudience: body.targetAudience || 'all',
  startsAt: parseOptionalDate(body.startsAt),
  endsAt: parseOptionalDate(body.endsAt),
  priority: parseOptionalNumber(body.priority, 0),
  sortOrder: parseOptionalNumber(body.sortOrder, 0),
  isActive: parseOptionalBoolean(body.isActive, true),
  image: body.image,
  desktopImage: body.desktopImage || body.image || '',
  mobileImage: body.mobileImage || '',
});

const assertSchedule = (startsAt, endsAt) => {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new AppError('Campaign start date must be before end date', 400);
  }
};

const activeScheduleFilter = (now = new Date()) => ({
  $and: [
    { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
    { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
  ],
});

export const getPublicBanners = asyncHandler(async (req, res) => {
  const { placement, audience = 'all' } = req.query;
  const filter = {
    isActive: true,
    ...activeScheduleFilter(),
    targetAudience: { $in: ['all', audience] },
  };
  if (placement) filter.placement = placement;

  const banners = await Banner.find(filter).sort({ priority: -1, sortOrder: 1, createdAt: -1 });
  res.json({ success: true, data: banners });
});

export const getAdminBanners = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ priority: -1, sortOrder: 1, createdAt: -1 });
  res.json({ success: true, data: banners });
});

export const createBanner = asyncHandler(async (req, res) => {
  const payload = buildBannerPayload(req.body);

  const mainUpload = await uploadOptionalImage({
    file: req.files?.image?.[0],
  });
  if (mainUpload) {
    payload.image = mainUpload.url;
    payload.cloudinaryPublicId = mainUpload.publicId;
  }

  const desktopUpload = await uploadOptionalImage({
    file: req.files?.desktopImage?.[0],
  });
  if (desktopUpload) {
    payload.desktopImage = desktopUpload.url;
    payload.desktopCloudinaryPublicId = desktopUpload.publicId;
  }

  const mobileUpload = await uploadOptionalImage({
    file: req.files?.mobileImage?.[0],
  });
  if (mobileUpload) {
    payload.mobileImage = mobileUpload.url;
    payload.mobileCloudinaryPublicId = mobileUpload.publicId;
  }

  payload.image = payload.image || payload.desktopImage || payload.mobileImage;
  payload.desktopImage = payload.desktopImage || payload.image;

  if (!payload.image) throw new AppError('Banner image is required', 400);
  assertSchedule(payload.startsAt, payload.endsAt);

  const banner = await Banner.create(payload);
  res.status(201).json({ success: true, data: banner });
});

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  const payload = buildBannerPayload({
    ...banner.toObject(),
    ...req.body,
  });
  assertSchedule(payload.startsAt, payload.endsAt);

  const mainUpload = await uploadOptionalImage({
    file: req.files?.image?.[0],
    currentPublicId: banner.cloudinaryPublicId,
  });
  if (mainUpload) {
    banner.image = mainUpload.url;
    banner.cloudinaryPublicId = mainUpload.publicId;
  } else {
    await setExternalImage({
      doc: banner,
      urlField: 'image',
      publicIdField: 'cloudinaryPublicId',
      nextUrl: req.body.image,
    });
  }

  const desktopUpload = await uploadOptionalImage({
    file: req.files?.desktopImage?.[0],
    currentPublicId: banner.desktopCloudinaryPublicId,
  });
  if (desktopUpload) {
    banner.desktopImage = desktopUpload.url;
    banner.desktopCloudinaryPublicId = desktopUpload.publicId;
  } else {
    await setExternalImage({
      doc: banner,
      urlField: 'desktopImage',
      publicIdField: 'desktopCloudinaryPublicId',
      nextUrl: req.body.desktopImage,
    });
  }

  const mobileUpload = await uploadOptionalImage({
    file: req.files?.mobileImage?.[0],
    currentPublicId: banner.mobileCloudinaryPublicId,
  });
  if (mobileUpload) {
    banner.mobileImage = mobileUpload.url;
    banner.mobileCloudinaryPublicId = mobileUpload.publicId;
  } else {
    await setExternalImage({
      doc: banner,
      urlField: 'mobileImage',
      publicIdField: 'mobileCloudinaryPublicId',
      nextUrl: req.body.mobileImage,
    });
  }

  banner.titleAr = payload.titleAr;
  banner.titleEn = payload.titleEn;
  banner.subtitleAr = payload.subtitleAr;
  banner.subtitleEn = payload.subtitleEn;
  banner.link = payload.link;
  banner.ctaAr = payload.ctaAr;
  banner.ctaEn = payload.ctaEn;
  banner.placement = payload.placement;
  banner.targetAudience = payload.targetAudience;
  banner.startsAt = payload.startsAt;
  banner.endsAt = payload.endsAt;
  banner.priority = payload.priority;
  banner.sortOrder = payload.sortOrder;
  banner.isActive = payload.isActive;

  banner.image = banner.image || banner.desktopImage || banner.mobileImage;
  banner.desktopImage = banner.desktopImage || banner.image;

  if (!banner.image) throw new AppError('Banner image is required', 400);

  await banner.save();
  res.json({ success: true, data: banner });
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  await Promise.all([
    deleteFromCloudinary(banner.cloudinaryPublicId),
    deleteFromCloudinary(banner.desktopCloudinaryPublicId),
    deleteFromCloudinary(banner.mobileCloudinaryPublicId),
  ]);
  await banner.deleteOne();

  res.json({ success: true, message: 'Banner deleted' });
});
