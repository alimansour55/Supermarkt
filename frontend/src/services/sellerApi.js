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
  getSecurity: () => api.get('/seller/me/security'),
  changePassword: (data) => api.put('/seller/me/password', data),
  setTwoFactor: (data) => api.put('/seller/me/two-factor', data),
  signOutEverywhere: () => api.post('/seller/me/sign-out-everywhere'),
  listActivity: (params) => api.get('/seller/activity', { params }),

  getDashboard: () => api.get('/seller/dashboard'),
  getSummary: () => api.get('/seller/summary'),
  getHome: (params) => api.get('/seller/home', { params }),
  getSalesReport: (params) => api.get('/seller/reports/sales', { params }),
  downloadSalesReport: (params) => api.get('/seller/reports/sales', { params: { ...params, format: 'csv' }, responseType: 'blob' }),
  search: (q) => api.get('/seller/search', { params: { q } }),

  getFinance: () => api.get('/seller/finance'),
  getMyReviews: (params) => api.get('/seller/reviews', { params }),
  getNotifications: (params) => api.get('/my-notifications', { params }),
  markNotificationsRead: () => api.patch('/my-notifications/read-all'),
  markNotificationRead: (id) => api.patch(`/my-notifications/${id}/read`),

  listTeam: () => api.get('/seller/team'),
  addTeamMember: (data) => api.post('/seller/team', data),
  updateTeamMember: (id, data) => api.put(`/seller/team/${id}`, data),

  listInbound: (params) => api.get('/seller/inbound', { params }),
  createInbound: (data) => api.post('/seller/inbound', data),
  cancelInbound: (id) => api.post(`/seller/inbound/${id}/cancel`),

  importProducts: (csv) => api.post('/seller/products/import', { csv }, { timeout: 120_000 }),
  getLedger: (params) => api.get('/seller/finance/ledger', { params }),
  getPayoutStatement: (id) => api.get(`/seller/finance/payouts/${id}/statement`),
  downloadPayoutStatement: (id) => api.get(`/seller/finance/payouts/${id}/statement`, { params: { format: 'csv' }, responseType: 'blob' }),
  listReturns: (params) => api.get('/seller/returns', { params }),
  setVacation: (data) => api.put('/seller/me/vacation', data),
  exportCatalog: () => api.get('/seller/products/export', { responseType: 'blob' }),
  listQuestions: (params) => api.get('/seller/questions', { params }),
  answerQuestion: (id, answer) => api.post(`/seller/questions/${id}/answer`, { answer }),
  setQuestionVisibility: (id, hidden) => api.post(`/seller/questions/${id}/visibility`, { hidden }),
  listProductReviews: (params) => api.get('/seller/product-reviews', { params }),
  replyProductReview: (productId, reviewId, message) => api.post(`/seller/product-reviews/${productId}/${reviewId}/reply`, { message }),
  noteReturn: (orderId, returnId, note) => api.post(`/seller/returns/${orderId}/${returnId}/note`, { note }),

  listShipments: (params) => api.get('/seller/shipments', { params }),
  getShipment: (id) => api.get(`/seller/shipments/${id}`),
  updateShipmentStatus: (id, data) => api.post(`/seller/shipments/${id}/status`, data),
  bulkShipmentStatus: (data) => api.post('/seller/shipments/bulk-status', data),
  exportShipments: (params) => api.get('/seller/shipments/export', { params, responseType: 'blob' }),

  listCategories: () => api.get('/seller/categories'),
  createCategory: (data) => api.post('/seller/categories', data),
  updateCategory: (id, data) => api.put(`/seller/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/seller/categories/${id}`),
  reorderCategories: (ids) => api.put('/seller/categories/reorder', { ids }),

  listProducts: (params) => api.get('/seller/products', { params }),
  duplicateProduct: (id) => api.post(`/seller/products/${id}/duplicate`),
  bulkProductCategories: (data) => api.post('/seller/products/bulk-categories', data),
  bulkInventory: (items) => api.put('/seller/products/bulk-inventory', { items }),
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
