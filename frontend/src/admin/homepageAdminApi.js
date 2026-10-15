import api from '../services/api';

/** Homepage builder endpoints (kept out of adminApi.js like the banner ones). */
export const homepageAdminApi = {
  list: () => api.get('/homepage-sections/admin'),
  create: (data) => api.post('/homepage-sections/admin', data),
  update: (id, data) => api.put(`/homepage-sections/admin/${id}`, data),
  remove: (id) => api.delete(`/homepage-sections/admin/${id}`),
  reorder: (order) => api.put('/homepage-sections/admin/reorder', { order }),
  duplicate: (id) => api.post(`/homepage-sections/admin/${id}/duplicate`),
  /** Render data for an unsaved section — nothing is saved. */
  preview: (data, config) => api.post('/homepage-sections/admin/preview', data, config),
  /** Public zone list — homepage editors may not have delivery permissions. */
  zones: () => api.get('/delivery-zones'),
};
