import api from '../services/api';

export const adminApi = {
  getStats: () => api.get('/admin/dashboard/stats'),

  getReports: (params) => api.get('/admin/reports', { params }),

  getNotifications: (params) => api.get('/admin/notifications', { params }),
  getUnreadNotificationCount: () => api.get('/admin/notifications/unread-count'),
  markNotificationRead: (id) => api.patch(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => api.patch('/admin/notifications/read-all'),

  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  getProducts: (params) => api.get('/products/admin', { params }),
  exportProducts: (params) =>
    api.get('/products/admin/export', { params, responseType: 'blob' }),
  bulkProducts: (ids, action) => api.post('/products/admin/bulk', { ids, action }),
  duplicateProduct: (id) => api.post(`/products/admin/${id}/duplicate`),
  getProduct: (id) => api.get(`/products/admin/${id}`),
  createProduct: (data) => api.post('/products/admin', data),
  updateProduct: (id, data) => api.put(`/products/admin/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/admin/${id}`),
  uploadImages: (productId, files) => {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    if (productId) form.append('productId', productId);
    return api.post('/products/admin/upload-images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeProductImage: (productId, publicId) =>
    api.delete(`/products/admin/${productId}/images`, { data: { publicId } }),
  reorderProductImages: (productId, images) =>
    api.put(`/products/admin/${productId}/images/reorder`, { images }),

  getCategories: (params) => api.get('/categories/admin', { params }),
  bulkCategories: (ids, action) => api.post('/categories/admin/bulk', { ids, action }),
  createCategory: (data) => {
    if (data instanceof FormData) {
      return api.post('/categories/admin', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/categories/admin', data);
  },
  updateCategory: (id, data) => {
    if (data instanceof FormData) {
      return api.put(`/categories/admin/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/categories/admin/${id}`, data);
  },
  deleteCategory: (id) => api.delete(`/categories/admin/${id}`),

  getOrders: (params) => api.get('/orders/admin', { params }),
  exportOrders: (params) =>
    api.get('/orders/admin/export', { params, responseType: 'blob' }),
  getOrder: (id) => api.get(`/orders/admin/${id}`),
  updateOrderStatus: (id, data) => api.put(`/orders/admin/${id}/status`, data),

  getUsers: (params) => api.get('/admin/users', { params }),
  bulkUsers: (ids, action) => api.post('/admin/users/bulk', { ids, action }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  getCoupons: (params) => api.get('/coupons/admin', { params }),
  bulkCoupons: (ids, action) => api.post('/coupons/admin/bulk', { ids, action }),
  createCoupon: (data) => api.post('/coupons/admin', data),
  updateCoupon: (id, data) => api.put(`/coupons/admin/${id}`, data),
  deleteCoupon: (id) => api.delete(`/coupons/admin/${id}`),

  getBanners: () => api.get('/banners/admin'),
  createBanner: (formData) => api.post('/banners/admin', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateBanner: (id, formData) => api.put(`/banners/admin/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteBanner: (id) => api.delete(`/banners/admin/${id}`),
};

export default adminApi;
