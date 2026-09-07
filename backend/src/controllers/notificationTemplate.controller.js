import NotificationTemplate from '../models/NotificationTemplate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { seedNotificationTemplates } from '../services/notificationTemplate.service.js';

const ALLOWED_FIELDS = [
  'nameAr',
  'nameEn',
  'channel',
  'subjectAr',
  'subjectEn',
  'bodyHtmlAr',
  'bodyHtmlEn',
  'bodyTextAr',
  'bodyTextEn',
  'smsBodyAr',
  'smsBodyEn',
  'placeholders',
  'isActive',
];

export const listAdminNotificationTemplates = asyncHandler(async (_req, res) => {
  const templates = await NotificationTemplate.find().sort({ channel: 1, key: 1 });
  res.json({ success: true, data: templates });
});

export const getAdminNotificationTemplate = asyncHandler(async (req, res) => {
  const template = await NotificationTemplate.findOne({ key: req.params.key });
  if (!template) throw new AppError('Template not found', 404);
  res.json({ success: true, data: template });
});

export const updateAdminNotificationTemplate = asyncHandler(async (req, res) => {
  const template = await NotificationTemplate.findOne({ key: req.params.key });
  if (!template) throw new AppError('Template not found', 404);

  ALLOWED_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) template[field] = req.body[field];
  });

  if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') {
    template.isActive = req.body.isActive === 'true' || req.body.isActive === '1';
  }

  await template.save();
  res.json({ success: true, data: template });
});

export const seedAdminNotificationTemplates = asyncHandler(async (_req, res) => {
  await seedNotificationTemplates();
  const templates = await NotificationTemplate.find().sort({ channel: 1, key: 1 });
  res.json({ success: true, data: templates, message: 'Templates seeded' });
});
