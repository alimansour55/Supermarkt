import api from '../services/api';

/** Admin → Connected systems (cashier/POS, ERP, files, webhooks). */
export const integrationsApi = {
  overview: () => api.get('/admin/integrations'),
  updateSettings: (data) => api.put('/admin/integrations/settings', data),
  rebuildStock: () => api.post('/admin/integrations/rebuild-stock'),

  create: (data) => api.post('/admin/integrations/connections', data),
  get: (id) => api.get(`/admin/integrations/connections/${id}`),
  update: (id, data) => api.patch(`/admin/integrations/connections/${id}`, data),
  remove: (id) => api.delete(`/admin/integrations/connections/${id}`),
  rotateKey: (id) => api.post(`/admin/integrations/connections/${id}/api-key`),
  rotateWebhookSecret: (id) => api.post(`/admin/integrations/connections/${id}/webhook-secret`),
  test: (id, what) => api.post(`/admin/integrations/connections/${id}/test`, { what }),
  run: (id) => api.post(`/admin/integrations/connections/${id}/run`),

  previewFile: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/admin/integrations/connections/${id}/file/preview`, form);
  },
  importFile: (id, file, { dryRun = false, columns } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('dryRun', String(dryRun));
    if (columns) form.append('columns', JSON.stringify(columns));
    return api.post(`/admin/integrations/connections/${id}/file/import`, form);
  },

  logs: (id, params) => api.get(`/admin/integrations/connections/${id}/logs`, { params }),
  deliveries: (id, params) => api.get(`/admin/integrations/connections/${id}/deliveries`, { params }),
  retryDelivery: (deliveryId) => api.post(`/admin/integrations/deliveries/${deliveryId}/retry`),
  recheckUnmatched: (id) => api.delete(`/admin/integrations/connections/${id}/unmatched`),
  productStock: (productId) => api.get(`/admin/integrations/products/${productId}/stock`),
  agentFile: (file) => api.get(`/admin/integrations/agent/${file}`, { responseType: 'blob' }),
};
