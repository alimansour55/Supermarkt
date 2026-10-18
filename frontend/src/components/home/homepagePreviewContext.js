import { createContext, useContext } from 'react';

/**
 * true inside the homepage builder's preview iframe. Per-shopper rows then show
 * the sample products the builder API sends instead of the admin's own history.
 */
export const HomepagePreviewContext = createContext(false);

export const useHomepagePreview = () => useContext(HomepagePreviewContext);
