import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { isHydrating } from '../utils/hydration';
import { useAuth } from './AuthContext';
import { favoriteService } from '../services/apiServices';
import { fetchProductsByIds } from '../services/productApi';

const FavoritesContext = createContext(null);

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

const normalizeIds = (ids) => {
  const list = Array.isArray(ids) ? ids : [];
  return [...new Set(list.map(String).filter(Boolean))];
};

const normalizeProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products.filter((product) => product && product._id != null);
};

const orderProductsByIds = (products, ids) => {
  const map = new Map(normalizeProducts(products).map((product) => [String(product._id), product]));
  return ids.map((id) => map.get(String(id))).filter(Boolean);
};

function readGuestFavoriteIds() {
  return normalizeIds(readJson(STORAGE_KEYS.FAVORITES, []));
}

function readGuestFavoriteProducts() {
  const products = normalizeProducts(readJson(STORAGE_KEYS.FAVORITE_PRODUCTS, []));
  return orderProductsByIds(products, readGuestFavoriteIds());
}

export function FavoritesProvider({ children }) {
  const { isAuthenticated, user, token } = useAuth();
  const userId = user?.id || user?._id || null;

  // After SSR, guest favorites are read from storage post-hydration (see effect below).
  const deferStorageRead = useRef(isHydrating());
  const [favorites, setFavorites] = useState(() => (
    deferStorageRead.current ? [] : readGuestFavoriteIds()
  ));
  const [favoriteProducts, setFavoriteProducts] = useState(() => (
    deferStorageRead.current ? [] : readGuestFavoriteProducts()
  ));

  useEffect(() => {
    if (!deferStorageRead.current) return;
    deferStorageRead.current = false;
    const ids = readGuestFavoriteIds();
    if (ids.length) {
      setFavorites(ids);
      setFavoriteProducts(readGuestFavoriteProducts());
    }
  }, []);
  const [loading, setLoading] = useState(false);

  const syncedUserId = useRef(null);
  const favoritesRef = useRef(favorites);
  const favoriteProductsRef = useRef(favoriteProducts);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    favoriteProductsRef.current = favoriteProducts;
  }, [favoriteProducts]);

  const persistGuest = useCallback((ids, products) => {
    writeJson(STORAGE_KEYS.FAVORITES, ids);
    writeJson(STORAGE_KEYS.FAVORITE_PRODUCTS, products);
  }, []);

  const applyServerState = useCallback((payload) => {
    const ids = normalizeIds(payload?.ids || payload?.productIds || []);
    const products = normalizeProducts(payload?.products);
    setFavorites(ids);
    setFavoriteProducts(products);
    writeJson(STORAGE_KEYS.FAVORITES, []);
    writeJson(STORAGE_KEYS.FAVORITE_PRODUCTS, []);
  }, []);

  // Sync with server when authenticated user changes
  useEffect(() => {
    if (!isAuthenticated || !token) {
      syncedUserId.current = null;
      const ids = normalizeIds(readJson(STORAGE_KEYS.FAVORITES, []));
      const products = orderProductsByIds(
        normalizeProducts(readJson(STORAGE_KEYS.FAVORITE_PRODUCTS, [])),
        ids,
      );
      setFavorites(ids);
      setFavoriteProducts(products);
      setLoading(false);
      return;
    }

    if (syncedUserId.current === userId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const guestIds = normalizeIds(readJson(STORAGE_KEYS.FAVORITES, []));
        const shouldMerge = guestIds.length > 0;
        const { data } = shouldMerge
          ? await favoriteService.merge(guestIds)
          : await favoriteService.list();

        if (!cancelled) {
          syncedUserId.current = userId;
          applyServerState(data);
        }
      } catch {
        if (!cancelled) {
          const ids = normalizeIds(readJson(STORAGE_KEYS.FAVORITES, []));
          const products = orderProductsByIds(
            normalizeProducts(readJson(STORAGE_KEYS.FAVORITE_PRODUCTS, [])),
            ids,
          );
          setFavorites(ids);
          setFavoriteProducts(products);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyServerState, isAuthenticated, token, userId]);

  // Guest: load missing product details by id (once per favorites change)
  const favoritesKey = favorites.join(',');
  useEffect(() => {
    if (isAuthenticated && token) return;

    if (!favorites.length) {
      setFavoriteProducts([]);
      return;
    }

    const current = favoriteProductsRef.current;
    const missingIds = favorites.filter(
      (id) => !current.some((product) => String(product._id) === String(id)),
    );

    const ordered = orderProductsByIds(current, favorites);
    if (!missingIds.length) {
      if (ordered.length !== current.length
        || ordered.some((product, index) => product !== current[index])) {
        setFavoriteProducts(ordered);
        persistGuest(favorites, ordered);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchProductsByIds(missingIds);
        if (cancelled) return;
        const merged = orderProductsByIds(
          [...favoriteProductsRef.current, ...fetched],
          favorites,
        );
        setFavoriteProducts(merged);
        persistGuest(favorites, merged);
      } catch {
        if (!cancelled) {
          const fallback = orderProductsByIds(favoriteProductsRef.current, favorites);
          setFavoriteProducts(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [favoritesKey, isAuthenticated, token, persistGuest]);

  const isFavorite = useCallback(
    (productId) => favorites.includes(String(productId)),
    [favorites],
  );

  const toggleFavorite = useCallback(async (productId, product = null) => {
    const id = String(productId);
    if (!id) return;

    const previousFavorites = favoritesRef.current;
    const previousProducts = favoriteProductsRef.current;
    const wasFavorite = previousFavorites.includes(id);
    const nextFavorites = wasFavorite
      ? previousFavorites.filter((favoriteId) => favoriteId !== id)
      : [...previousFavorites, id];
    const nextProducts = wasFavorite
      ? previousProducts.filter((item) => String(item._id) !== id)
      : product
        ? orderProductsByIds([...previousProducts, product], nextFavorites)
        : previousProducts;

    setFavorites(nextFavorites);
    setFavoriteProducts(nextProducts);

    if (!isAuthenticated || !token) {
      persistGuest(nextFavorites, nextProducts);
      return;
    }

    try {
      const { data } = wasFavorite
        ? await favoriteService.remove(id)
        : await favoriteService.add(id);
      applyServerState(data);
    } catch {
      setFavorites(previousFavorites);
      setFavoriteProducts(previousProducts);
    }
  }, [applyServerState, isAuthenticated, persistGuest, token]);

  const value = useMemo(
    () => ({
      favorites,
      favoriteProducts,
      favoriteCount: favorites.length,
      loading,
      isFavorite,
      toggleFavorite,
    }),
    [favoriteProducts, favorites, isFavorite, loading, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
