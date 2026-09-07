import api from './api';

const useApi = import.meta.env.VITE_USE_API !== 'false';

export async function fetchContentPage(slug) {
  if (!useApi) {
    throw new Error('Content pages require the API because they are managed from the CMS.');
  }

  const { data } = await api.get(`/content-pages/${slug}`);
  return data.data;
}

export async function fetchContentPages() {
  if (!useApi) {
    throw new Error('Content pages require the API because they are managed from the CMS.');
  }

  const { data } = await api.get('/content-pages');
  return data.data;
}

export async function fetchAdminContentPages() {
  const { data } = await api.get('/content-pages/admin');
  return data.data;
}

export async function fetchAdminContentPage(slug) {
  const { data } = await api.get(`/content-pages/admin/${slug}`);
  return data.data;
}

export async function updateContentPage(slug, payload) {
  const { data } = await api.put(`/content-pages/admin/${slug}`, payload);
  return data.data;
}
