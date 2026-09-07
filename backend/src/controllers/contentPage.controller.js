import ContentPage from '../models/ContentPage.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { CONTENT_PAGE_SLUGS, DEFAULT_CONTENT_PAGES } from '../constants/contentPages.js';

function formatContentPage(page) {
  const doc = page.toObject?.() ?? page;
  return {
    ...doc,
    sections: [...(doc.sections || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  };
}

export async function ensureContentPagesSeeded() {
  await Promise.all(
    CONTENT_PAGE_SLUGS.map((slug, index) => {
      const defaults = DEFAULT_CONTENT_PAGES[slug];
      return ContentPage.updateOne(
        { slug },
        {
          $setOnInsert: {
            ...defaults,
            sortOrder: index,
            isActive: true,
          },
        },
        { upsert: true },
      );
    }),
  );
}

export const getPublicContentPages = asyncHandler(async (_req, res) => {
  await ensureContentPagesSeeded();

  const pages = await ContentPage.find({ isActive: true }).sort({ sortOrder: 1, slug: 1 });

  res.json({
    success: true,
    data: pages.map(formatContentPage),
  });
});

export const getPublicContentPage = asyncHandler(async (req, res) => {
  await ensureContentPagesSeeded();

  const page = await ContentPage.findOne({ slug: req.params.slug, isActive: true });
  if (!page) throw new AppError('Page not found', 404);

  res.json({ success: true, data: formatContentPage(page) });
});

export const getAdminContentPages = asyncHandler(async (_req, res) => {
  await ensureContentPagesSeeded();

  const pages = await ContentPage.find().sort({ sortOrder: 1, slug: 1 });
  res.json({ success: true, data: pages.map(formatContentPage) });
});

export const getAdminContentPage = asyncHandler(async (req, res) => {
  await ensureContentPagesSeeded();

  const page = await ContentPage.findOne({ slug: req.params.slug });
  if (!page) throw new AppError('Page not found', 404);

  res.json({ success: true, data: formatContentPage(page) });
});

export const updateAdminContentPage = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!CONTENT_PAGE_SLUGS.includes(slug)) {
    throw new AppError('Invalid page slug', 400);
  }

  await ensureContentPagesSeeded();

  const allowed = [
    'titleAr', 'titleEn', 'seoTitleAr', 'seoTitleEn',
    'seoDescriptionAr', 'seoDescriptionEn', 'sections', 'isActive', 'sortOrder',
  ];

  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (updates.sections !== undefined && !Array.isArray(updates.sections)) {
    throw new AppError('Sections must be an array', 400);
  }

  if (updates.sections) {
    updates.sections = updates.sections.map((section, index) => ({
      headingAr: section.headingAr || '',
      headingEn: section.headingEn || '',
      bodyAr: section.bodyAr || '',
      bodyEn: section.bodyEn || '',
      sortOrder: section.sortOrder ?? index,
    }));
  }

  const page = await ContentPage.findOneAndUpdate(
    { slug },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!page) throw new AppError('Page not found', 404);

  res.json({ success: true, data: formatContentPage(page) });
});
