import { initApiConnection } from './initApiConnection';
import { fetchHomepageSections } from '../services/homepageApi';
import { fetchStoreSettings } from '../services/storeSettingsApi';
import { fetchCategoryTree } from '../services/productApi';

/** Kick off critical storefront APIs as early as possible. */
export function warmStorefront() {
  const prefetchApis = () => {
    void fetchHomepageSections();
    void fetchStoreSettings();
    void fetchCategoryTree().catch(() => {});
  };

  void initApiConnection().then(prefetchApis);
}
