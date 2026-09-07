import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/AppError.js';

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);

  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (jpeg, png, webp, gif)', 400));
  }
};

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadMultiple = (fieldName, maxCount = 10) => upload.array(fieldName, maxCount);

/** Parse JSON order payload from multipart field `order`. */
export const parseOrderMultipartBody = (req, res, next) => {
  if (typeof req.body?.order === 'string') {
    try {
      const parsed = JSON.parse(req.body.order);
      req.body = {
        ...parsed,
        manualPaymentAccount: req.body.manualPaymentAccount ?? parsed.manualPaymentAccount,
      };
    } catch {
      return next(new AppError('Invalid order payload', 400));
    }
  }
  return next();
};

/** Run multer only for multipart requests (JSON body updates skip file parsing). */
export const optionalUploadSingle = (fieldName) => (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }
  return upload.single(fieldName)(req, res, next);
};

const productMediaFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageExt = /\.(jpe?g|png|webp|gif)$/;
  const videoExt = /\.(mp4|webm|mov|mpeg|quicktime)$/;
  const isImage = imageExt.test(ext) && file.mimetype.startsWith('image/');
  const isVideo = videoExt.test(ext) && file.mimetype.startsWith('video/');

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new AppError('Only image (jpeg, png, webp, gif) or video (mp4, webm, mov) files are allowed', 400));
  }
};

export const uploadProductMedia = multer({
  storage,
  fileFilter: productMediaFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadProductMediaMultiple = (fieldName, maxCount = 10) =>
  uploadProductMedia.array(fieldName, maxCount);

export const uploadFields = (fields) => upload.fields(fields);

/** Run multer only for multipart requests (JSON body updates skip file parsing). */
export const optionalUploadFields = (fields) => (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }
  return upload.fields(fields)(req, res, next);
};
