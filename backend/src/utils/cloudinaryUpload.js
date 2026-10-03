import { Readable } from 'node:stream';
import { cloudinary, configureCloudinary } from '../config/cloudinary.js';
import { AppError } from './AppError.js';

export const CLOUDINARY_FOLDERS = {
  products: 'marketplus/products',
  categories: 'marketplus/categories',
  banners: 'marketplus/banners',
  store: 'marketplus/store',
  homepage: 'marketplus/homepage',
  paymentProofs: 'marketplus/payment-proofs',
  walletTopUps: 'marketplus/wallet-topups',
  deliveryProofs: 'marketplus/delivery-proofs',
};

let cloudinaryReady = false;

export const initCloudinary = () => {
  cloudinaryReady = configureCloudinary();
  return cloudinaryReady;
};

export const isCloudinaryReady = () => cloudinaryReady;

const assertCloudinary = () => {
  if (!cloudinaryReady) {
    throw new AppError('Cloudinary is not configured', 503);
  }
};

const getFileResourceType = (file) => (file.mimetype?.startsWith('video/') ? 'video' : 'image');

export const uploadFileToCloudinary = async (file, folder = CLOUDINARY_FOLDERS.products) => {
  assertCloudinary();

  if (!file?.buffer?.length) {
    throw new AppError('Invalid media file', 400);
  }

  const resourceType = getFileResourceType(file);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          type: resourceType,
        });
      },
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

export const uploadFilesToCloudinary = async (files, folder = CLOUDINARY_FOLDERS.products) => {
  if (!files?.length) return [];
  return Promise.all(files.map((file) => uploadFileToCloudinary(file, folder)));
};

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId || !cloudinaryReady) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
};

export const deleteManyFromCloudinary = async (publicIds = [], mediaTypes = []) => {
  const ids = publicIds.filter(Boolean);
  if (!ids.length) return;
  await Promise.all(ids.map((id, index) => deleteFromCloudinary(id, mediaTypes[index] || 'image')));
};

export const deleteProductCloudinaryAssets = async (product) => {
  if (!product?.cloudinaryPublicIds?.length) return;
  await deleteManyFromCloudinary(product.cloudinaryPublicIds, product.mediaTypes);
};

export const appendProductMedia = (product, uploaded = []) => {
  if (!product.mediaTypes) product.mediaTypes = [];
  uploaded.forEach(({ url, publicId, type }) => {
    product.images.push(url);
    product.cloudinaryPublicIds.push(publicId);
    product.mediaTypes.push(type || 'image');
  });
};

/** @deprecated use appendProductMedia */
export const appendProductImages = appendProductMedia;

export const removeProductImageByPublicId = async (product, publicId) => {
  const index = product.cloudinaryPublicIds.findIndex((id) => id === publicId);

  if (index === -1) {
    const urlIndex = product.images.findIndex((url) => url.includes(publicId.split('/').pop()));
    if (urlIndex === -1) {
      throw new AppError('Media not found on product', 404);
    }
    product.images.splice(urlIndex, 1);
    product.mediaTypes?.splice(urlIndex, 1);
    await product.save();
    return product;
  }

  const resourceType = product.mediaTypes?.[index] || 'image';
  await deleteFromCloudinary(publicId, resourceType);
  product.cloudinaryPublicIds.splice(index, 1);
  product.images.splice(index, 1);
  product.mediaTypes?.splice(index, 1);
  await product.save();
  return product;
};

export const replaceCloudinaryImage = async ({
  file,
  folder,
  currentPublicId,
  currentResourceType = 'image',
}) => {
  if (currentPublicId) {
    await deleteFromCloudinary(currentPublicId, currentResourceType);
  }

  if (!file) {
    return { url: null, publicId: null, type: 'image' };
  }

  return uploadFileToCloudinary(file, folder);
};

// Backward-compatible aliases
export const uploadToCloudinary = uploadFileToCloudinary;
export const uploadMultipleToCloudinary = uploadFilesToCloudinary;
