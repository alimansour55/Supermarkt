import api from './api';

/** Public marketplace endpoints (no seller session needed). */
export const marketplaceApi = {
  getConfig: () => api.get('/sellers/config'),
  apply: (data) => api.post('/sellers/apply', data),
  getSeller: (slug) => api.get(`/sellers/${encodeURIComponent(slug)}`),
};

/** Seller portal — every call runs as the signed-in seller. */
export const sellerApi = {
  getMe: () => api.get('/seller/me'),
  updateProfile: (data) => api.put('/seller/me', data),
  updateBank: (data) => api.put('/seller/me/bank', data),
  uploadDocument: (type, file) => {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    return api.post('/seller/me/documents', form);
  },
  deleteDocument: (docId) => api.delete(`/seller/me/documents/${docId}`),
  resubmit: () => api.post('/seller/me/resubmit'),

  getDashboard: () => api.get('/seller/dashboard'),

  listProducts: (params) => api.get('/seller/products', { params }),
  getProduct: (id) => api.get(`/seller/products/${id}`),
  createProduct: (data) => api.post('/seller/products', data),
  updateProduct: (id, data) => api.put(`/seller/products/${id}`, data),
  updateStock: (id, data) => api.put(`/seller/products/${id}/stock`, data),
  submitProduct: (id) => api.post(`/seller/products/${id}/submit`),
  pauseProduct: (id) => api.post(`/seller/products/${id}/pause`),
  unpauseProduct: (id) => api.post(`/seller/products/${id}/unpause`),
  discardChanges: (id) => api.post(`/seller/products/${id}/discard-changes`),
  deleteProduct: (id) => api.delete(`/seller/products/${id}`),
  uploadMedia: (files) => {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    return api.post('/seller/products/media', form, { timeout: 120_000 });
  },
};
