import api from '../services/api';

/** Admin banner endpoints (the banner list also returns where each banner is used). */
export const bannerAdminApi = {
  list: () => api.get('/banners/admin'),
  create: (formData) => api.post('/banners/admin', formData),
  update: (id, formData) => api.put(`/banners/admin/${id}`, formData),
  setStatus: (id, isActive) => api.patch(`/banners/admin/${id}/status`, { isActive }),
  reorder: (placement, ids) => api.put('/banners/admin/reorder', { placement, ids }),
  duplicate: (id) => api.post(`/banners/admin/${id}/duplicate`),
  remove: (id) => api.delete(`/banners/admin/${id}`),
};
