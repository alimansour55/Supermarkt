import api from './api';

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getOffers: (params) => api.get('/products/offers', { params }),
  getBySlug: (slug) => api.get(`/products/${slug}`),
  getByCategory: (slug, params) => api.get(`/products/category/${slug}`, { params }),
  getFilters: () => api.get('/products/filters/meta'),
};

export const categoryService = {
  getAll: () => api.get('/categories'),
  getBySlug: (slug) => api.get(`/categories/${slug}`),
};

export const orderService = {
  create: (data) => api.post('/orders', data),
  getMyOrders: () => api.get('/orders/my-orders'),
  getById: (id) => api.get(`/orders/${id}`),
  calculate: (data) => api.post('/orders/calculate', data),
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
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
};

export const healthService = {
  check: () => api.get('/health'),
};

export const cartService = {
  get: () => api.get('/cart'),
  add: (productId, quantity = 1) => api.post('/cart/add', { productId, quantity }),
  update: (productId, quantity) => api.put('/cart/update', { productId, quantity }),
  remove: (productId) => api.delete(`/cart/remove/${productId}`),
  sync: (data) => api.put('/cart/sync', data),
  merge: (guestItems) => api.post('/cart/merge', { guestItems }),
  clear: () => api.delete('/cart/clear'),
  applyDiscount: (code) => api.post('/cart/discount', { code }),
  removeDiscount: () => api.delete('/cart/discount'),
};

export const couponService = {
  validate: (code, subtotal) => api.post('/coupons/validate', { code, subtotal }),
  list: () => api.get('/coupons'),
};

/** Public banners for hero slider and promo strips (from seed or admin) */
export const bannerService = {
  getPublic: (placement) => api.get('/banners', { params: placement ? { placement } : {} }),
};
