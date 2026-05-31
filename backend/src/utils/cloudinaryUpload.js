import { Readable } from 'node:stream';
import { cloudinary, configureCloudinary } from '../config/cloudinary.js';
import { AppError } from './AppError.js';

export const CLOUDINARY_FOLDERS = {
  products: 'marketplus/products',
  categories: 'marketplus/categories',
  banners: 'marketplus/banners',
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

export const uploadFileToCloudinary = async (file, folder = CLOUDINARY_FOLDERS.products) => {
  assertCloudinary();

  if (!file?.buffer?.length) {
    throw new AppError('Invalid image file', 400);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
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

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || !cloudinaryReady) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
};

export const deleteManyFromCloudinary = async (publicIds = []) => {
  const ids = publicIds.filter(Boolean);
  if (!ids.length) return;
  await Promise.all(ids.map((id) => deleteFromCloudinary(id)));
};

export const appendProductImages = (product, uploaded = []) => {
  uploaded.forEach(({ url, publicId }) => {
    product.images.push(url);
    product.cloudinaryPublicIds.push(publicId);
  });
};

export const removeProductImageByPublicId = async (product, publicId) => {
  const index = product.cloudinaryPublicIds.findIndex((id) => id === publicId);

  if (index === -1) {
    const urlIndex = product.images.findIndex((url) => url.includes(publicId.split('/').pop()));
    if (urlIndex === -1) {
      throw new AppError('Image not found on product', 404);
    }
    product.images.splice(urlIndex, 1);
    await product.save();
    return product;
  }

  await deleteFromCloudinary(publicId);
  product.cloudinaryPublicIds.splice(index, 1);
  product.images.splice(index, 1);
  await product.save();
  return product;
};

export const replaceCloudinaryImage = async ({
  file,
  folder,
  currentPublicId,
}) => {
  if (currentPublicId) {
    await deleteFromCloudinary(currentPublicId);
  }

  if (!file) {
    return { url: null, publicId: null };
  }

  const uploaded = await uploadFileToCloudinary(file, folder);
  return uploaded;
};

// Backward-compatible aliases
export const uploadToCloudinary = uploadFileToCloudinary;
export const uploadMultipleToCloudinary = uploadFilesToCloudinary;
