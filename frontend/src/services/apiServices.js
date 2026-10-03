import api from './api';

export const categoryService = {
  getAll: (params) => api.get('/categories', { params }),
  getMain: () => api.get('/categories/main'),
  getTree: () => api.get('/categories/tree'),
  getBrowse: (slugPath) => api.get(`/categories/browse/${slugPath}`),
  getSlugPath: (slug) => api.get(`/categories/path/${slug}`),
  getSubcategories: (slug) => api.get(`/categories/${slug}/subcategories`),
  getBySlug: (slug) => api.get(`/categories/${slug}`),
};

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getByIds: (ids) => api.post('/products/by-ids', { ids }),
  getOffers: (params) => api.get('/products/offers', { params }),
  getBySlug: (slug) => api.get(`/products/${slug}`),
  getByCategory: (slug, params) => api.get(`/products/category/${slug}`, { params }),
  getByCategoryPath: (slugPath, params) => api.get(`/products/category-path/${slugPath}`, { params }),
  getByMainSub: (mainSlug, subSlug, params) => api.get(`/products/category/${mainSlug}/${subSlug}`, { params }),
  getFilters: (params) => api.get('/products/filters/meta', { params }),
};

export const orderService = {
  create: (data) => api.post('/orders', data),
  createWithPaymentProof: (data, proofFile) => {
    const form = new FormData();
    form.append('order', JSON.stringify(data));
    if (proofFile) form.append('paymentProof', proofFile);
    return api.post('/orders', form);
  },
  uploadPaymentProof: (orderId, proofFile, manualPaymentAccount, lang = 'ar') => {
    const form = new FormData();
    form.append('paymentProof', proofFile);
    if (manualPaymentAccount) form.append('manualPaymentAccount', manualPaymentAccount);
    form.append('lang', lang);
    return api.post(`/orders/${orderId}/payment-proof`, form);
  },
  getMyOrders: () => api.get('/orders/my-orders'),
  getById: (id) => api.get(`/orders/${id}`),
  calculate: (data) => api.post('/orders/calculate', data),
  cancel: (id, data) => api.post(`/orders/${id}/cancel`, data),
  updateItems: (id, data) => api.patch(`/orders/${id}/items`, data),
  respondSubstitution: (id, subId, data) => api.put(`/orders/${id}/substitutions/${subId}`, data),
  addMessage: (id, data) => api.post(`/orders/${id}/messages`, data),
  getMessages: (id) => api.get(`/orders/${id}/messages`),
  requestReturn: (id, data) => api.post(`/orders/${id}/returns`, data),
  downloadInvoice: (id, lang = 'ar') =>
    api.get(`/orders/${id}/invoice`, { params: { lang }, responseType: 'blob' }),
  getTracking: (id) => api.get(`/orders/${id}/tracking`),
  getDriverConfig: () => api.get('/orders/driver/config'),
  setDriverAvailability: (available) => api.put('/orders/driver/availability', { available }),
  getDriverDeliveries: () => api.get('/orders/driver/deliveries'),
  getDriverHistory: () => api.get('/orders/driver/deliveries/history'),
  getDriverDelivery: (id) => api.get(`/orders/driver/deliveries/${id}`),
  completeDriverDelivery: (id, photoFile) => {
    if (!photoFile) return api.post(`/orders/driver/deliveries/${id}/complete`);
    const form = new FormData();
    form.append('proofPhoto', photoFile);
    return api.post(`/orders/driver/deliveries/${id}/complete`, form);
  },
  failDriverDelivery: (id, data) => api.post(`/orders/driver/deliveries/${id}/fail`, data),
  updateDriverLocation: (id, data) => api.put(`/orders/${id}/tracking/location`, data),
  getRecurringDeliveries: () => api.get('/orders/recurring-deliveries'),
  updateRecurringDelivery: (id, data) => api.patch(`/orders/recurring-deliveries/${id}`, data),
  pauseRecurringDelivery: (id) => api.patch(`/orders/recurring-deliveries/${id}/pause`),
  resumeRecurringDelivery: (id) => api.patch(`/orders/recurring-deliveries/${id}/resume`),
  cancelRecurringDelivery: (id) => api.patch(`/orders/recurring-deliveries/${id}/cancel`),
};

export const paymentService = {
  createCheckoutSession: (orderId) => api.post('/payment/create-checkout-session', { orderId }),
  verifySession: (sessionId, orderId) => api.get('/payment/verify-session', {
    params: { session_id: sessionId, order_id: orderId },
  }),
  createIntent: (orderId) => api.post('/payment/create-intent', { orderId }),
  confirm: (orderId) => api.post('/payment/confirm', { orderId }),
};

export const authService = {
  sendOtp: (data) => api.post('/auth/send-otp', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  adminLogin: (data) => api.post('/auth/admin-login', data),
  driverLogin: (data) => api.post('/auth/driver-login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
  addAddress: (data) => api.post('/auth/me/addresses', data),
  updateAddress: (id, data) => api.patch(`/auth/me/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/auth/me/addresses/${id}`),
};

export const healthService = {
  check: () => api.get('/health'),
};

export const cartService = {
  get: (config) => api.get('/cart', config),
  add: (productId, quantity = 1, variantId = null) => api.post('/cart/add', { productId, quantity, variantId }),
  update: (productId, quantity, variantId = null) => api.put('/cart/update', { productId, quantity, variantId }),
  remove: (productId, variantId = null) => api.delete(`/cart/remove/${productId}`, { params: variantId ? { variantId } : {} }),
  sync: (data) => api.put('/cart/sync', data),
  merge: (guestItems, extras = {}) => api.post('/cart/merge', { guestItems, ...extras }),
  clear: () => api.delete('/cart/clear'),
  applyDiscount: (code, subtotal, items, extras = {}) =>
    api.post('/cart/discount', { code, subtotal, items, ...extras }),
  removeDiscount: () => api.delete('/cart/discount'),
  reserve: (items, lang = 'ar') => api.post('/cart/reserve', { items, lang }),
};

export const couponService = {
  validate: (code, subtotal) => api.post('/coupons/validate', { code, subtotal }),
  list: () => api.get('/coupons'),
};

export const favoriteService = {
  list: () => api.get('/favorites'),
  add: (productId) => api.post(`/favorites/${productId}`),
  remove: (productId) => api.delete(`/favorites/${productId}`),
  merge: (productIds) => api.post('/favorites/merge', { productIds }),
};

export const deliveryZoneService = {
  list: () => api.get('/delivery-zones'),
  validate: (zoneId) => api.get('/delivery-zones/validate', { params: { zoneId } }),
  geocode: (data) => api.post('/delivery-zones/geocode', data),
  suggestPlaces: (data) => api.post('/delivery-zones/places-suggest', data),
  resolvePlace: (data) => api.post('/delivery-zones/resolve-place', data),
  validateAddress: (data) => api.post('/delivery-zones/validate-address', data),
};

export const loyaltyService = {
  getMe: (language = 'ar') => api.get('/loyalty/me', { params: { lang: language } }),
};

export const walletService = {
  getMe: (language = 'ar') => api.get('/wallet/me', { params: { lang: language } }),
  createTopUp: ({ amount, method, destinationAccount, senderReference, proofFile, lang = 'ar' }) => {
    const form = new FormData();
    form.append('amount', String(amount));
    form.append('method', method);
    form.append('destinationAccount', destinationAccount);
    if (senderReference) form.append('senderReference', senderReference);
    form.append('lang', lang);
    if (proofFile) form.append('proof', proofFile);
    return api.post('/wallet/topup', form);
  },
  getTopUp: (id) => api.get(`/wallet/topup/${id}`),
};

export const reviewService = {
  getEligibility: (productId, orderId = null) =>
    api.get(`/reviews/products/${productId}/eligibility`, { params: orderId ? { orderId } : {} }),
  submit: (productId, data) => api.put(`/reviews/products/${productId}`, data),
  deleteMine: (productId) => api.delete(`/reviews/products/${productId}`),
  getAdmin: (params) => api.get('/reviews/admin', { params }),
  updateStatus: (productId, reviewId, status) => api.patch(`/reviews/admin/${productId}/${reviewId}`, { status }),
  deleteAdmin: (productId, reviewId) => api.delete(`/reviews/admin/${productId}/${reviewId}`),
};

/** Public banners for hero slider and promo strips (from seed or admin) */
export const bannerService = {
  getPublic: (placement) => api.get('/banners', { params: placement ? { placement } : {} }),
};

export const notificationService = {
  getAll: (params) => api.get('/my-notifications', { params }),
  getUnreadCount: () => api.get('/my-notifications/unread-count'),
  markRead: (id) => api.patch(`/my-notifications/${id}/read`),
  markAllRead: () => api.patch('/my-notifications/read-all'),
};
