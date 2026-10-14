import Banner from '../models/Banner.js';
import HomepageSection from '../models/HomepageSection.js';
import { AppError } from '../utils/AppError.js';
import {
  uploadFileToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import {
  BANNER_PLACEMENTS,
  BANNER_SORT,
  audiencesForViewer,
  fillBilingual,
  liveBannerFilter,
  parseBannerScheduleInstant,
  viewerAudience,
} from '../utils/bannerRules.js';

const AUDIENCES = ['all', 'guests', 'customers', 'staff'];
const IMAGE_SLOTS = [
  { field: 'image', urlField: 'image', publicIdField: 'cloudinaryPublicId' },
  { field: 'desktopImage', urlField: 'desktopImage', publicIdField: 'desktopCloudinaryPublicId' },
  { field: 'mobileImage', urlField: 'mobileImage', publicIdField: 'mobileCloudinaryPublicId' },
];
const AUDITED_FIELDS = [
  'titleAr', 'titleEn', 'subtitleAr', 'subtitleEn', 'link', 'ctaAr', 'ctaEn',
  'placement', 'targetAudience', 'isActive', 'showText', 'image', 'desktopImage', 'mobileImage',
];

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

const parseScheduleField = (value) => {
  const date = parseBannerScheduleInstant(value);
  if (date === undefined) throw new AppError('Invalid campaign date', 400);
  return date;
};

const normalizeBannerLink = (link) => {
  if (!link || typeof link !== 'string') return '/offers';
  let s = link.trim();
  if (!s) return '/offers';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+$/, '') || s;
};

const trimText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Normalise the editable fields. `body` is the full intended state (the admin
 * form always sends every field), so an empty string really means "clear it".
 */
const buildBannerPayload = (body) => {
  const title = fillBilingual(body.titleAr, body.titleEn);
  const cta = fillBilingual(body.ctaAr, body.ctaEn);
  const placement = BANNER_PLACEMENTS.includes(body.placement) ? body.placement : 'hero';
  const targetAudience = AUDIENCES.includes(body.targetAudience) ? body.targetAudience : 'all';
  return {
    titleAr: title.ar,
    titleEn: title.en,
    subtitleAr: trimText(body.subtitleAr),
    subtitleEn: trimText(body.subtitleEn),
    link: normalizeBannerLink(body.link),
    ctaAr: cta.ar || 'تسوق الآن',
    ctaEn: cta.en || 'Shop Now',
    placement,
    targetAudience,
    startsAt: parseScheduleField(body.startsAt),
    endsAt: parseScheduleField(body.endsAt),
    priority: parseOptionalNumber(body.priority, 0),
    sortOrder: parseOptionalNumber(body.sortOrder, 0),
    isActive: parseOptionalBoolean(body.isActive, true),
    showText: parseOptionalBoolean(body.showText, true),
  };
};

const validatePayload = (payload) => {
  if (!payload.titleAr && !payload.titleEn) throw new AppError('Banner title is required', 400);
  if (payload.startsAt && payload.endsAt && payload.startsAt > payload.endsAt) {
    throw new AppError('Campaign start date must be before end date', 400);
  }
};

const uploadImage = async (file) => {
  try {
    return await uploadFileToCloudinary(file, CLOUDINARY_FOLDERS.banners);
  } catch {
    throw new AppError('Image upload failed — configure Cloudinary or provide image URL', 400);
  }
};

/** Upload every file in the request first, so a failure leaves nothing half-changed. */
const uploadRequestFiles = async (files) => {
  const uploads = {};
  try {
    for (const { field } of IMAGE_SLOTS) {
      const file = files?.[field]?.[0];
      if (file) uploads[field] = await uploadImage(file);
    }
  } catch (error) {
    await Promise.allSettled(Object.values(uploads).map((u) => deleteFromCloudinary(u.publicId)));
    throw error;
  }
  return uploads;
};

/**
 * Remove Cloudinary files that are no longer used. Duplicated banners share image
 * URLs, so a file is only destroyed when no banner (in its saved state) still points at it.
 */
const destroyUnusedImages = async (entries) => {
  const work = entries
    .filter((e) => e.publicId)
    .map(async ({ publicId, url }) => {
      const filter = {
        $or: [
          { cloudinaryPublicId: publicId },
          { desktopCloudinaryPublicId: publicId },
          { mobileCloudinaryPublicId: publicId },
          ...(url ? [{ image: url }, { desktopImage: url }, { mobileImage: url }] : []),
        ],
      };
      if (await Banner.exists(filter)) return;
      await deleteFromCloudinary(publicId);
    });
  const results = await Promise.allSettled(work);
  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('Banner image cleanup failed:', r.reason?.message));
};

/**
 * Apply uploads / pasted URLs to the banner's three image slots. Returns the
 * Cloudinary files that were replaced so the caller can clean them up after the
 * save succeeds (never before — a failed save must not lose the old image).
 */
const applyImages = (doc, body, uploads) => {
  const replaced = [];
  for (const { field, urlField, publicIdField } of IMAGE_SLOTS) {
    const upload = uploads[field];
    const nextUrl = upload ? upload.url : body[field];
    if (nextUrl === undefined || (!upload && trimText(nextUrl) === (doc[urlField] || ''))) continue;
    if (doc[publicIdField]) replaced.push({ publicId: doc[publicIdField], url: doc[urlField] });
    doc[urlField] = upload ? upload.url : trimText(nextUrl);
    doc[publicIdField] = upload ? upload.publicId : '';
  }

  // `image` is the legacy main image that older readers use. It follows the
  // desktop image (or the mobile one) once the admin has touched the desktop slot.
  const desktopTouched = Boolean(uploads.desktopImage) || body.desktopImage !== undefined;
  const imageTouched = Boolean(uploads.image) || body.image !== undefined;
  if (!imageTouched) {
    const nextImage = desktopTouched
      ? doc.desktopImage || doc.mobileImage
      : doc.desktopImage || doc.image || doc.mobileImage;
    if (nextImage !== doc.image) {
      if (doc.cloudinaryPublicId) replaced.push({ publicId: doc.cloudinaryPublicId, url: doc.image });
      doc.image = nextImage || '';
      doc.cloudinaryPublicId = '';
    }
  }
  if (!doc.desktopImage && !desktopTouched) doc.desktopImage = doc.image;
  return replaced;
};

const ensureImage = (doc) => {
  if (!doc.image && !doc.desktopImage && !doc.mobileImage) {
    throw new AppError('Banner image is required', 400);
  }
};

/** Where each banner is used in the homepage builder, plus which sections pull each placement automatically. */
async function loadBannerUsage() {
  const sections = await HomepageSection.find({
    type: { $in: ['hero_slider', 'promo_grid', 'image_strip', 'sidebar_banners'] },
  }).select('type titleAr titleEn isActive heroMode heroSlides heroRotation campaignPlacement layout').lean();

  const byBanner = new Map();
  const byPlacement = { hero: [], promo: [], sidebar: [] };
  const defaultPlacement = { hero_slider: 'hero', promo_grid: 'promo', image_strip: 'promo', sidebar_banners: 'sidebar' };

  for (const section of sections) {
    const label = {
      sectionId: section._id,
      titleAr: section.titleAr || '',
      titleEn: section.titleEn || '',
      type: section.type,
      isActive: section.isActive !== false,
    };
    const rotation = section.heroRotation || {};
    const slides = [
      ...(section.heroSlides || []),
      ...(rotation.slots || []),
      ...(rotation.fallbackAfterSlides || []),
      ...(rotation.periods || []).flatMap((p) => p.slides || []),
    ];
    for (const slide of slides) {
      if (slide?.source !== 'banner' || !slide.bannerId) continue;
      const key = String(slide.bannerId);
      const list = byBanner.get(key) || [];
      if (!list.some((s) => String(s.sectionId) === String(section._id))) list.push(label);
      byBanner.set(key, list);
    }
    const mode = section.heroMode ?? ((section.heroSlides || []).length ? 'curated' : 'auto');
    if (mode === 'auto' || section.type === 'sidebar_banners') {
      const placement = section.campaignPlacement || defaultPlacement[section.type];
      if (byPlacement[placement]) byPlacement[placement].push(label);
    }
  }
  return { byBanner, byPlacement };
}

export const getPublicBanners = asyncHandler(async (req, res) => {
  const { placement } = req.query;
  // Audience comes from who is signed in — never from the query string.
  const audiences = audiencesForViewer(viewerAudience(req.user));
  const filter = {
    ...liveBannerFilter(),
    targetAudience: { $in: audiences },
  };
  if (placement) filter.placement = placement;

  const banners = await Banner.find(filter)
    .select('-cloudinaryPublicId -desktopCloudinaryPublicId -mobileCloudinaryPublicId')
    .sort(BANNER_SORT);
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ success: true, data: banners });
});

export const getAdminBanners = asyncHandler(async (_req, res) => {
  const [banners, usage] = await Promise.all([
    Banner.find().sort(BANNER_SORT).lean(),
    loadBannerUsage(),
  ]);
  const data = banners.map((b) => ({ ...b, usedIn: usage.byBanner.get(String(b._id)) || [] }));
  res.json({ success: true, data, meta: { placementSections: usage.byPlacement } });
});

export const createBanner = asyncHandler(async (req, res) => {
  const payload = buildBannerPayload(req.body);
  validatePayload(payload);
  if (req.body.sortOrder === undefined || req.body.sortOrder === '') {
    // New banners go to the end of their placement's list.
    const last = await Banner.findOne({ placement: payload.placement }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    payload.sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const uploads = await uploadRequestFiles(req.files);
  const banner = new Banner(payload);
  try {
    applyImages(banner, req.body, uploads);
    ensureImage(banner);
    await banner.save();
  } catch (error) {
    await destroyUnusedImages(Object.values(uploads));
    throw error;
  }

  await logAudit({
    req, action: 'create', entityType: 'banner', entityId: banner._id, entityLabel: banner.titleAr || banner.titleEn,
  });
  res.status(201).json({ success: true, data: banner });
});

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);
  const before = banner.toObject();

  const payload = buildBannerPayload({ ...before, ...req.body });
  validatePayload(payload);

  const uploads = await uploadRequestFiles(req.files);
  let replaced = [];
  try {
    Object.assign(banner, payload);
    replaced = applyImages(banner, req.body, uploads);
    ensureImage(banner);
    await banner.save();
  } catch (error) {
    await destroyUnusedImages(Object.values(uploads));
    throw error;
  }
  await destroyUnusedImages(replaced);

  await logAudit({
    req,
    action: 'update',
    entityType: 'banner',
    entityId: banner._id,
    entityLabel: banner.titleAr || banner.titleEn,
    changes: pickChanges(before, banner.toObject(), AUDITED_FIELDS),
  });
  res.json({ success: true, data: banner });
});

/** Pause / resume without resending the whole banner. */
export const setBannerStatus = asyncHandler(async (req, res) => {
  const isActive = parseOptionalBoolean(req.body?.isActive, null);
  if (isActive === null) throw new AppError('isActive is required', 400);
  const banner = await Banner.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!banner) throw new AppError('Banner not found', 404);

  await logAudit({
    req,
    action: 'update',
    entityType: 'banner',
    entityId: banner._id,
    entityLabel: banner.titleAr || banner.titleEn,
    changes: { isActive: { from: !isActive, to: isActive } },
  });
  res.json({ success: true, data: banner });
});

/** Save the drag-and-drop order of one placement. The list order becomes the display order. */
export const reorderBanners = asyncHandler(async (req, res) => {
  const { placement, ids } = req.body || {};
  if (!BANNER_PLACEMENTS.includes(placement)) throw new AppError('Invalid placement', 400);
  if (!Array.isArray(ids) || !ids.length) throw new AppError('ids must be a non-empty array', 400);

  const count = await Banner.countDocuments({ _id: { $in: ids }, placement });
  if (count !== ids.length) throw new AppError('Some banners were not found in this placement', 400);

  await Banner.bulkWrite(ids.map((id, index) => ({
    updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index, priority: 0 } } },
  })));

  await logAudit({
    req, action: 'update', entityType: 'banner', entityLabel: `reorder:${placement}`, changes: { order: ids },
  });
  res.json({ success: true });
});

/** Copy a banner as a paused draft. Images are shared by URL (cleanup checks references). */
export const duplicateBanner = asyncHandler(async (req, res) => {
  const source = await Banner.findById(req.params.id).lean();
  if (!source) throw new AppError('Banner not found', 404);

  const {
    _id, createdAt, updatedAt, __v, cloudinaryPublicId, desktopCloudinaryPublicId, mobileCloudinaryPublicId, ...rest
  } = source;
  const last = await Banner.findOne({ placement: source.placement }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const copy = await Banner.create({
    ...rest,
    titleAr: `${source.titleAr} (نسخة)`,
    titleEn: `${source.titleEn} (copy)`,
    isActive: false,
    priority: 0,
    sortOrder: (last?.sortOrder ?? -1) + 1,
  });

  await logAudit({
    req, action: 'create', entityType: 'banner', entityId: copy._id, entityLabel: copy.titleAr || copy.titleEn,
    changes: { duplicatedFrom: String(_id) },
  });
  res.status(201).json({ success: true, data: copy });
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  const images = IMAGE_SLOTS.map(({ urlField, publicIdField }) => ({
    publicId: banner[publicIdField],
    url: banner[urlField],
  }));
  await banner.deleteOne();
  // Cloudinary trouble must not block deleting the banner itself.
  await destroyUnusedImages(images);

  await logAudit({
    req, action: 'delete', entityType: 'banner', entityId: banner._id, entityLabel: banner.titleAr || banner.titleEn,
  });
  res.json({ success: true, message: 'Banner deleted' });
});
