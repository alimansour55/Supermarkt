import api from './api';
import { SHOP_BRANDS } from '../data/shopBrands';
import { normalizeBrandEntry } from '../utils/shopBrandHelpers';

const useApi = import.meta.env.VITE_USE_API !== 'false';

export async function fetchBrands(params = {}) {
  if (!useApi) {
    return SHOP_BRANDS.map(normalizeBrandEntry);
  }
  try {
    const { data } = await api.get('/brands', { params });
    return data.data || [];
  } catch {
    return SHOP_BRANDS.map(normalizeBrandEntry);
  }
}
