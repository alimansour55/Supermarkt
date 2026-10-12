import api from './api';

/** Public marketplace endpoints (no seller session needed). */
export const marketplaceApi = {
  getConfig: () => api.get('/sellers/config'),
  apply: (data) => api.post('/sellers/apply', data),
  getSeller: (slug) => api.get(`/sellers/${encodeURIComponent(slug)}`),
  getReviews: (slug, params) => api.get(`/sellers/${encodeURIComponent(slug)}/reviews`, { params }),
  getCategories: (slug) => api.get(`/sellers/${encodeURIComponent(slug)}/categories`),
  rateShipment: (orderId, shipmentId, data) => api.post(`/orders/${orderId}/shipments/${shipmentId}/review`, data),
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

  getFinance: () => api.get('/seller/finance'),
  getMyReviews: (params) => api.get('/seller/reviews', { params }),
  getNotifications: (params) => api.get('/my-notifications', { params }),
  markNotificationsRead: () => api.patch('/my-notifications/read-all'),

  listTeam: () => api.get('/seller/team'),
  addTeamMember: (data) => api.post('/seller/team', data),
  updateTeamMember: (id, data) => api.put(`/seller/team/${id}`, data),

  listInbound: (params) => api.get('/seller/inbound', { params }),
  createInbound: (data) => api.post('/seller/inbound', data),
  cancelInbound: (id) => api.post(`/seller/inbound/${id}/cancel`),

  importProducts: (csv) => api.post('/seller/products/import', { csv }, { timeout: 120_000 }),
  getLedger: (params) => api.get('/seller/finance/ledger', { params }),

  listShipments: (params) => api.get('/seller/shipments', { params }),
  getShipment: (id) => api.get(`/seller/shipments/${id}`),
  updateShipmentStatus: (id, data) => api.post(`/seller/shipments/${id}/status`, data),

  listCategories: () => api.get('/seller/categories'),
  createCategory: (data) => api.post('/seller/categories', data),
  updateCategory: (id, data) => api.put(`/seller/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/seller/categories/${id}`),
  reorderCategories: (ids) => api.put('/seller/categories/reorder', { ids }),

  listProducts: (params) => api.get('/seller/products', { params }),
  duplicateProduct: (id) => api.post(`/seller/products/${id}/duplicate`),
  bulkProductCategories: (data) => api.post('/seller/products/bulk-categories', data),
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
