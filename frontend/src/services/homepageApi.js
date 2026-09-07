import api from './api';
import {
  getCachedHomepageSections,
  getInflightHomepage,
  setCachedHomepageSections,
  trackHomepageInflight,
} from '../utils/homepageCache';

export async function fetchHomepageSections({ revalidate = false } = {}) {
  const cached = getCachedHomepageSections();
  if (cached && !revalidate) return cached;

  const inflight = getInflightHomepage();
  if (inflight) return inflight;

  const request = api.get('/homepage-sections').then(({ data }) => {
    const sections = data.data || [];
    setCachedHomepageSections(sections);
    return sections;
  });

  return trackHomepageInflight(request);
}
