import api from '../services/api';

export const adminApi = {
  getStats: () => api.get('/admin/dashboard/stats'),
  getDashboardSalesTrend: (period) => api.get('/admin/dashboard/sales-trend', { params: { period } }),

  getRevenue: (params) => api.get('/admin/revenue', { params }),
  getRevenueAnalytics: (params) => api.get('/admin/revenue/analytics', { params }),

  getReports: (params) => api.get('/admin/reports', { params }),

  getPartnerRevenueDistribution: (params) => api.get('/admin/partner-revenue/distribution', { params }),
  getPartnerRevenueSettings: () => api.get('/admin/partner-revenue/settings'),
  updatePartnerRevenueSettings: (data) => api.put('/admin/partner-revenue/settings', data),
  searchPartnerRevenueProducts: (params) => api.get('/admin/partner-revenue/search-products', { params }),
  searchPartnerRevenueCustomers: (params) => api.get('/admin/partner-revenue/search-customers', { params }),
  simulatePartnerRevenue: (data) => api.post('/admin/partner-revenue/simulate', data),
  getPartnerStatement: (key, params) => api.get(`/admin/partner-revenue/partners/${key}/statement`, { params }),
  getPartnerLedger: (key) => api.get(`/admin/partner-revenue/partners/${key}/ledger`),
  addPartnerLedgerEntry: (key, data) => api.post(`/admin/partner-revenue/partners/${key}/ledger`, data),
  deletePartnerLedgerEntry: (id) => api.delete(`/admin/partner-revenue/ledger/${id}`),
  exportPartnerPayoutBatch: (params) => api.get('/admin/partner-revenue/payouts/export', { params, responseType: 'blob' }),
  getPartnerPayouts: (params) => api.get('/admin/partner-revenue/payouts', { params }),
  getPartnerPayoutSummary: () => api.get('/admin/partner-revenue/payouts/summary'),
  generatePartnerPayouts: (data) => api.post('/admin/partner-revenue/payouts/generate', data),
  createPartnerPayout: (data) => api.post('/admin/partner-revenue/payouts', data),
  updatePartnerPayout: (id, data) => api.patch(`/admin/partner-revenue/payouts/${id}`, data),
  setPartnerPayoutStatus: (id, data) => api.patch(`/admin/partner-revenue/payouts/${id}/status`, data),
  deletePartnerPayout: (id) => api.delete(`/admin/partner-revenue/payouts/${id}`),

  getSearchAnalytics: (params) => api.get('/search/admin/analytics', { params }),

  getNotifications: (params) => api.get('/admin/notifications', { params }),
  getUnreadNotificationCount: () => api.get('/admin/notifications/unread-count'),
  markNotificationRead: (id) => api.patch(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => api.patch('/admin/notifications/read-all'),

  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  getProducts: (params) => api.get('/products/admin', { params }),
  getProductsStats: (params) => api.get('/products/admin/stats-summary', { params }),
  getStockSummary: (params) => api.get('/products/admin/stock-summary', { params }),
  importProducts: (csv) => api.post('/products/admin/import', { csv }),
  exportProducts: (params) =>
    api.get('/products/admin/export', { params, responseType: 'blob' }),
  bulkProducts: (ids, action, payload = {}) => api.post('/products/admin/bulk', { ids, action, ...payload }),
  getProductCategoryIntegrity: (params) => api.get('/products/admin/category-integrity', { params }),
  repairProductCategoryIntegrity: (body) => api.post('/products/admin/category-integrity/repair', body),
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

  suggestProductSku: (body) => api.post('/products/admin/sku/suggest', body),
  checkProductSku: (sku, excludeId) =>
    api.get('/products/admin/sku/check', { params: { sku, excludeId } }),

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
  reorderCategories: (body) => api.put('/categories/admin/reorder', body),
  reassignCategoryProducts: (id, payload) => api.post(`/categories/admin/${id}/reassign-products`, payload),

  getBrands: (params) => api.get('/brands/admin', { params }),
  getBrandStats: () => api.get('/brands/admin/stats'),
  createBrand: (data) => {
    if (data instanceof FormData) {
      return api.post('/brands/admin', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/brands/admin', data);
  },
  updateBrand: (id, data) => {
    if (data instanceof FormData) {
      return api.put(`/brands/admin/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.put(`/brands/admin/${id}`, data);
  },
  deleteBrand: (id) => api.delete(`/brands/admin/${id}`),
  bulkBrands: (ids, action) => api.post('/brands/admin/bulk', { ids, action }),
  reorderBrands: (order) => api.put('/brands/admin/reorder', { order }),
  syncBrandsFromProducts: () => api.post('/brands/admin/sync-from-products'),
  repairProductBrandLinks: (body) => api.post('/brands/admin/repair-product-links', body),

  getOrders: (params) => api.get('/orders/admin', { params }),
  getOrderChats: (params) => api.get('/orders/admin/messages', { params }),
  exportOrders: (params) =>
    api.get('/orders/admin/export', { params, responseType: 'blob' }),
  getOrder: (id) => api.get(`/orders/admin/${id}`),
  updateOrderStatus: (id, data) => api.put(`/orders/admin/${id}/status`, data),
  cancelOrder: (id, data) => api.post(`/orders/admin/${id}/cancel`, data),
  refundOrder: (id, data) => api.post(`/orders/admin/${id}/refund`, data),
  suggestSubstitution: (id, data) => api.post(`/orders/admin/${id}/substitutions`, data),
  assignDriver: (id, data) => api.put(`/orders/admin/${id}/assign-driver`, data),
  getLiveDeliveries: () => api.get('/orders/admin/live-deliveries'),
  getOrderTracking: (id) => api.get(`/orders/admin/${id}/tracking`),
  getTrackingSimulation: (id) => api.get(`/orders/admin/${id}/tracking/simulate`),
  startTrackingSimulation: (id, data) => api.post(`/orders/admin/${id}/tracking/simulate`, data),
  stopTrackingSimulation: (id) => api.delete(`/orders/admin/${id}/tracking/simulate`),
  getDeliveryStaff: () => api.get('/orders/admin/delivery-staff'),
  getOrderTrash: (params) => api.get('/orders/admin/trash', { params }),
  trashOrder: (id) => api.patch(`/orders/admin/${id}/trash`),
  trashOrderSecond: (id) => api.patch(`/orders/admin/${id}/trash/second`),
  restoreOrder: (id) => api.patch(`/orders/admin/${id}/restore`),
  deleteOrderForever: (id) => api.delete(`/orders/admin/${id}/permanent`),
  bulkTrashOrders: (ids) => api.post('/orders/admin/trash/bulk', { ids }),
  bulkTrashOrdersSecond: (ids) => api.post('/orders/admin/trash/second/bulk', { ids }),
  bulkRestoreOrders: (ids) => api.post('/orders/admin/restore/bulk', { ids }),
  bulkDeleteOrdersForever: (ids) => api.post('/orders/admin/permanent/bulk', { ids }),
  getOrderResetStatus: () => api.get('/orders/admin/reset-all/status'),
  resetAllOrders: (confirmPhrase) => api.post('/orders/admin/reset-all', { confirmPhrase }),
  addOrderMessage: (id, data) => api.post(`/orders/admin/${id}/messages`, data),
  getOrderMessages: (id) => api.get(`/orders/admin/${id}/messages`),
  getReturns: (params) => api.get('/admin/order-returns', { params }),
  requestOrderReturn: (id, data) => api.post(`/orders/admin/${id}/returns`, data),
  reviewReturn: (orderId, returnId, data) =>
    api.patch(`/orders/admin/${orderId}/returns/${returnId}`, data),
  updateReturnFulfillment: (orderId, returnId, fulfillmentStatus) =>
    api.patch(`/orders/admin/${orderId}/returns/${returnId}/fulfillment`, {
      fulfillmentStatus,
    }),
  downloadInvoice: (id, lang = 'ar') =>
    api.get(`/orders/admin/${id}/invoice`, { params: { lang }, responseType: 'blob' }),
  listCallbackRequests: (params = {}) => api.get('/support/admin/callback-requests', { params }),
  updateCallbackRequest: (id, data) => api.patch(`/support/admin/callback-requests/${id}`, data),
  getLiveChats: (params = {}) => api.get('/support-chat/admin', { params }),
  getLiveChatMessages: (id) => api.get(`/support-chat/admin/${id}/messages`),
  addLiveChatMessage: (id, data) => api.post(`/support-chat/admin/${id}/messages`, data),
  updateLiveChat: (id, data) => api.patch(`/support-chat/admin/${id}`, data),
  getLiveChatAgents: () => api.get('/support-chat/admin/agents'),
  setLiveChatAgentEnabled: (userId, enabled) => api.patch(`/support-chat/admin/agents/${userId}`, { enabled }),
  getMyLiveChatProfile: () => api.get('/support-chat/admin/agents/me'),
  updateMyLiveChatProfile: (data) => api.patch('/support-chat/admin/agents/me', data),
  getLiveChatPerformance: () => api.get('/support-chat/admin/performance'),
  getLiveChatHistoryForUser: (userId) => api.get(`/support-chat/admin/history/${userId}`),
  getRecurringDeliveries: (params) => api.get('/orders/admin/recurring-deliveries', { params }),
  getRecurringStats: () => api.get('/orders/admin/recurring-deliveries/stats'),
  getRecurringDelivery: (id) => api.get(`/orders/admin/recurring-deliveries/${id}`),
  updateRecurringDelivery: (id, data) => api.patch(`/orders/admin/recurring-deliveries/${id}`, data),
  pauseRecurringDelivery: (id) => api.patch(`/orders/admin/recurring-deliveries/${id}/pause`),
  resumeRecurringDelivery: (id) => api.patch(`/orders/admin/recurring-deliveries/${id}/resume`),
  cancelRecurringDelivery: (id) => api.patch(`/orders/admin/recurring-deliveries/${id}/cancel`),
  advanceRecurringDelivery: (id) => api.post(`/orders/admin/recurring-deliveries/${id}/advance`),

  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  getUser: (id) => api.get(`/admin/users/${id}`),
  bulkUsers: (ids, action) => api.post('/admin/users/bulk', { ids, action }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  getStaffAccounts: (params) => api.get('/admin/staff', { params }),
  getStaffAccount: (id) => api.get(`/admin/staff/${id}`),
  createStaffAccount: (data) => api.post('/admin/staff', data),
  updateStaffAccount: (id, data) => api.put(`/admin/staff/${id}`, data),
  resetStaffPassword: (id, data = {}) => api.post(`/admin/staff/${id}/reset-password`, data),
  deleteStaffAccount: (id) => api.delete(`/admin/staff/${id}`),
  getStaffPermissionMeta: () => api.get('/admin/staff/permissions'),

  getCoupons: (params) => api.get('/coupons/admin', { params }),
  bulkCoupons: (ids, action) => api.post('/coupons/admin/bulk', { ids, action }),
  createCoupon: (data) => api.post('/coupons/admin', data),
  updateCoupon: (id, data) => api.put(`/coupons/admin/${id}`, data),
  deleteCoupon: (id) => api.delete(`/coupons/admin/${id}`),

  getPromotions: (params) => api.get('/promotions/admin', { params }),
  getPromotionStats: () => api.get('/promotions/admin/stats'),
  getPromotion: (id) => api.get(`/promotions/admin/${id}`),
  getPromotionProducts: (id, params) => api.get(`/promotions/admin/${id}/products`, { params }),
  createPromotion: (data) => api.post('/promotions/admin', data),
  updatePromotion: (id, data) => api.put(`/promotions/admin/${id}`, data),
  togglePromotion: (id, data) => api.patch(`/promotions/admin/${id}/toggle`, data),
  bulkPromotions: (ids, action) => api.post('/promotions/admin/bulk', { ids, action }),
  deletePromotion: (id) => api.delete(`/promotions/admin/${id}`),

  getCatalogOffers: (params) => api.get('/promotions/admin/catalog-offers', { params }),
  toggleCatalogOffer: (productId, data) => api.patch(`/promotions/admin/catalog-offers/${productId}`, data),
  patchCatalogOffer: (productId, data) => api.patch(`/promotions/admin/catalog-offers/${productId}`, data),
  bulkCatalogOffers: (ids, action) => api.post('/promotions/admin/catalog-offers/bulk', { ids, action }),
  importCatalogOffers: (data) => api.post('/promotions/admin/catalog-offers/import', data),

  getBanners: () => api.get('/banners/admin'),
  createBanner: (formData) => api.post('/banners/admin', formData),
  updateBanner: (id, formData) => api.put(`/banners/admin/${id}`, formData),
  deleteBanner: (id) => api.delete(`/banners/admin/${id}`),

  getHomepageSections: () => api.get('/homepage-sections/admin'),
  getHomepageCampaignCandidates: () => api.get('/homepage-sections/admin/campaign-candidates'),
  createHomepageSection: (data) => api.post('/homepage-sections/admin', data),
  updateHomepageSection: (id, data) => api.put(`/homepage-sections/admin/${id}`, data),
  reorderHomepageSections: (order) => api.put('/homepage-sections/admin/reorder', { order }),
  deleteHomepageSection: (id) => api.delete(`/homepage-sections/admin/${id}`),
  uploadHeroSlideImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/homepage-sections/admin/upload-hero-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getDeliveryZones: () => api.get('/delivery-zones/admin'),
  createDeliveryZone: (data) => api.post('/delivery-zones/admin', data),
  updateDeliveryZone: (id, data) => api.put(`/delivery-zones/admin/${id}`, data),
  deleteDeliveryZone: (id) => api.delete(`/delivery-zones/admin/${id}`),

  getFulfillmentLocations: () => api.get('/fulfillment-locations/admin'),
  createFulfillmentLocation: (data) => api.post('/fulfillment-locations/admin', data),
  updateFulfillmentLocation: (id, data) => api.put(`/fulfillment-locations/admin/${id}`, data),
  deleteFulfillmentLocation: (id) => api.delete(`/fulfillment-locations/admin/${id}`),
  geocodeFulfillmentLocation: (data) => api.post('/fulfillment-locations/admin/geocode', data),

  getReviews: (params) => api.get('/reviews/admin', { params }),
  getReviewProductFilters: (params) => api.get('/reviews/admin/product-filters', { params }),
  getReviewStats: () => api.get('/reviews/admin/stats'),
  exportReviews: (params) => api.get('/reviews/admin/export', { params, responseType: 'blob' }),
  bulkReviews: (items, action) => api.post('/reviews/admin/bulk', { items, action }),
  requestOrderReview: (orderId) => api.post(`/reviews/admin/orders/${orderId}/request`),
  updateReviewStatus: (productId, reviewId, payload) => api.patch(`/reviews/admin/${productId}/${reviewId}`, payload),
  deleteReview: (productId, reviewId) => api.delete(`/reviews/admin/${productId}/${reviewId}`),

  getStoreSettings: () => api.get('/store-settings/admin'),
  updateStoreSettings: (formData) => api.put('/store-settings/admin', formData),
  updateStoreSettingsJson: (settings) => api.put('/store-settings/admin', settings),
  previewInvoicePdf: (lang = 'ar') =>
    api.get('/store-settings/admin/invoice-preview', { params: { lang }, responseType: 'blob' }),

  getContentPages: () => api.get('/content-pages/admin'),
  getContentPage: (slug) => api.get(`/content-pages/admin/${slug}`),
  updateContentPage: (slug, data) => api.put(`/content-pages/admin/${slug}`, data),

  getLoyaltyRules: () => api.get('/loyalty/admin/rules'),
  updateLoyaltyRules: (data) => api.put('/loyalty/admin/rules', data),
  getLoyaltyOverview: () => api.get('/loyalty/admin/overview'),
  searchLoyaltyUsers: (search, params = {}) => api.get('/loyalty/admin/users', { params: { search, ...params } }),
  getUserLoyalty: (userId) => api.get(`/loyalty/admin/users/${userId}`),
  adjustUserPoints: (userId, data) => api.post(`/loyalty/admin/users/${userId}/adjust`, data),

  getWalletOverview: () => api.get('/wallet/admin/overview'),
  getWalletSettings: () => api.get('/wallet/admin/settings'),
  updateWalletSettings: (data) => api.put('/wallet/admin/settings', data),
  listWalletTopUps: (params = {}) => api.get('/wallet/admin/topups', { params }),
  approveWalletTopUp: (id, data = {}) => api.post(`/wallet/admin/topups/${id}/approve`, data),
  rejectWalletTopUp: (id, data) => api.post(`/wallet/admin/topups/${id}/reject`, data),
  searchWalletUsers: (search, params = {}) => api.get('/wallet/admin/users', { params: { search, ...params } }),
  getUserWallet: (userId) => api.get(`/wallet/admin/users/${userId}`),
  adjustUserWallet: (userId, data) => api.post(`/wallet/admin/users/${userId}/adjust`, data),

  getNotificationTemplates: () => api.get('/notification-templates/admin'),
  getNotificationTemplate: (key) => api.get(`/notification-templates/admin/${key}`),
  updateNotificationTemplate: (key, data) => api.put(`/notification-templates/admin/${key}`, data),
  seedNotificationTemplates: () => api.post('/notification-templates/admin/seed'),
};

export default adminApi;
