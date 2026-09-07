import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useStoreSettings } from './StoreSettingsContext';
import { useLanguage } from './LanguageContext';
import { useToast } from '../components/ui/Toast';
import { calculateCartTotals, validateCouponAsync, normalizeCoupon } from '../utils/cartCalculations';
import { calculateItemsSubtotal } from '../utils/cartLinePricing';
import { clampQuantityToStock, getProductAvailableStock } from '../utils/productHelpers';
import {
  getCartLineStockUnits,
  getCartOfferLine,
  getCartPromoBreakdown,
  mergePromoFieldsFromProduct,
  summarizeCartOffers,
} from '../utils/cartPromotion';
import { fetchProductsByIds } from '../services/productApi';
import { cartService } from '../services/apiServices';
import { trackSearchConversion } from '../services/searchApi';
import { getLastSearchQuery } from '../utils/searchSession';

const CartContext = createContext(null);

function itemKey(item) {
  return item.cartKey || `${item.productId}:${item.variantId || ''}`;
}

function normalizeItem(product, quantity = 1) {
  const productId = product._id || product.productId;
  const variantId = product.variantId || null;
  const availableStock = product.availableStock ?? getProductAvailableStock(product, variantId);
  return {
    productId,
    variantId,
    cartKey: product.cartKey || `${productId}:${variantId || ''}`,
    slug: product.slug,
    name: product.name || product.nameAr,
    nameEn: product.nameEn,
    variantLabelAr: product.variantLabelAr,
    variantLabelEn: product.variantLabelEn,
    sku: product.sku,
    price: product.price,
    oldPrice: product.oldPrice ?? product.compareAtPrice ?? null,
    compareAtPrice: product.compareAtPrice ?? product.oldPrice ?? null,
    discount: product.discount ?? null,
    discountPercent: product.discountPercent ?? product.discount ?? null,
    isOffer: product.isOffer ?? false,
    activePromotionId: product.activePromotionId ?? null,
    emoji: product.emoji,
    image: product.image,
    availableStock,
    promotionType: product.promotionType || null,
    offerBadgeAr: product.offerBadgeAr || null,
    offerBadgeEn: product.offerBadgeEn || null,
    promotionBuyQty: product.promotionBuyQty ?? null,
    promotionGetQty: product.promotionGetQty ?? null,
    promotionUnit: product.promotionUnit ?? 'pieces',
    promotionCartLineAr: product.promotionCartLineAr ?? null,
    promotionCartLineEn: product.promotionCartLineEn ?? null,
    promotionCartProgressAr: product.promotionCartProgressAr ?? null,
    promotionCartProgressEn: product.promotionCartProgressEn ?? null,
    promotionCartSubtextAr: product.promotionCartSubtextAr ?? null,
    promotionCartSubtextEn: product.promotionCartSubtextEn ?? null,
    promotionSecondPercentOff: product.promotionSecondPercentOff ?? null,
    quantity: clampQuantityToStock(quantity, availableStock) || quantity,
  };
}

export function CartProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { location } = useLocation();
  const { settings } = useStoreSettings();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [items, setItems] = useLocalStorage(STORAGE_KEYS.CART, []);
  const [discountCode, setDiscountCode, removeDiscountCodeStorage] = useLocalStorage(STORAGE_KEYS.DISCOUNT, null);
  const [appliedCoupon, setAppliedCoupon, removeAppliedCouponStorage] = useLocalStorage(STORAGE_KEYS.APPLIED_COUPON, null);
  const [deliveryMethod, setDeliveryMethod] = useLocalStorage(STORAGE_KEYS.DELIVERY_METHOD, 'scheduled');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bumpProductId, setBumpProductId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const bumpTimer = useRef(null);
  const [discountError, setDiscountError] = useState('');
  const syncTimer = useRef(null);
  const mergedRef = useRef(false);
  const skipCouponRevalidateRef = useRef(false);
  const promoEnrichSigRef = useRef('');

  /** Refresh offer metadata from product API (covers legacy carts + all offer types). */
  const enrichCartPromoFields = useCallback((cartItems, { force = false } = {}) => {
    const ids = [...new Set(cartItems.map((item) => String(item.productId || '')).filter(Boolean))];
    if (!ids.length) return Promise.resolve();

    const sig = ids.sort().join(',');
    if (!force && promoEnrichSigRef.current === sig && cartItems.every((item) => getCartOfferLine(item, isAr))) {
      return Promise.resolve();
    }

    return fetchProductsByIds(ids)
      .then((products) => {
        if (!products?.length) return;
        const byId = new Map(products.map((p) => [String(p._id), p]));
        setItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            const product = byId.get(String(item.productId));
            if (!product) return item;
            const merged = mergePromoFieldsFromProduct(item, product);
            if (JSON.stringify(merged) !== JSON.stringify(item)) changed = true;
            return merged;
          });
          if (changed) promoEnrichSigRef.current = sig;
          return changed ? next : prev;
        });
      })
      .catch(() => {});
  }, [isAr, setItems]);

  useEffect(() => {
    if (!items.length) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) enrichCartPromoFields(items);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items, enrichCartPromoFields]);

  const drawerOpenedRef = useRef(false);

  useEffect(() => {
    if (!isDrawerOpen) {
      drawerOpenedRef.current = false;
      return undefined;
    }
    if (!items.length) return undefined;
    if (!drawerOpenedRef.current) {
      drawerOpenedRef.current = true;
      enrichCartPromoFields(items, { force: true });
    }
    return undefined;
  }, [isDrawerOpen, items, enrichCartPromoFields]);

  const persistCoupon = useCallback((code, coupon) => {
    const normalized = normalizeCoupon(coupon);
    if (!normalized) return;
    setDiscountCode(normalized.code);
    setAppliedCoupon(normalized);
    setDiscountError('');
  }, [setDiscountCode, setAppliedCoupon]);

  const clearCoupon = useCallback(() => {
    removeDiscountCodeStorage();
    removeAppliedCouponStorage();
    setDiscountError('');
  }, [removeDiscountCodeStorage, removeAppliedCouponStorage]);

  const totals = useMemo(
    () => calculateCartTotals({
      items,
      deliveryMethod,
      discountCode,
      deliveryZone: location,
      appliedCoupon,
      storeFreeDeliverySettings: {
        freeDeliveryEnabled: settings?.freeDeliveryEnabled !== false,
        freeDeliveryMethods: settings?.freeDeliveryMethods,
      },
    }),
    [items, deliveryMethod, discountCode, location, appliedCoupon, settings?.freeDeliveryEnabled, settings?.freeDeliveryMethods],
  );

  const persistToServer = useCallback(async (nextItems, nextDiscount, nextDelivery) => {
    if (!isAuthenticated) return;
    try {
      const { data } = await cartService.sync({
        items: nextItems,
        discountCode: nextDiscount,
        deliveryMethod: nextDelivery,
        deliveryZoneId: location?.id,
        lang: language,
      });
      const serverItems = data?.cart?.items;
      if (!Array.isArray(serverItems)) return;

      const localQty = nextItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const serverQty = serverItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      setItems(serverItems);

      if (serverQty < localQty) {
        toast.info(
          isAr
            ? 'تم تعديل الكميات حسب المخزون المتاح'
            : 'Quantities were adjusted to available stock',
          3500,
        );
      }
    } catch (err) {
      const message = err.response?.data?.message;
      if (message) {
        toast.info(message, 4000);
      } else {
        console.error('Cart sync failed:', err);
      }
    }
  }, [isAuthenticated, location?.id, setItems, isAr, toast, language]);

  const scheduleSync = useCallback((nextItems, nextDiscount, nextDelivery) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      persistToServer(nextItems, nextDiscount, nextDelivery);
    }, 800);
  }, [persistToServer]);

  const updateItems = useCallback((updater, sync = true) => {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (sync && isAuthenticated) {
        scheduleSync(next, discountCode, deliveryMethod);
      }
      return next;
    });
  }, [setItems, isAuthenticated, discountCode, deliveryMethod, scheduleSync]);

  // Hydrate cart from server when logged in (merge only once right after login)
  useEffect(() => {
    if (authLoading || !isAuthenticated || mergedRef.current) return;

    const applyServerCart = (cart) => {
      if (cart?.items) setItems(cart.items);
      if (cart?.discountCode) setDiscountCode(cart.discountCode);
      if (cart?.appliedCoupon) setAppliedCoupon(normalizeCoupon(cart.appliedCoupon));
      if (cart?.deliveryMethod) setDeliveryMethod(cart.deliveryMethod);
    };

    const hydrate = async () => {
      setSyncing(true);
      try {
        const guestItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
        const storedDiscount = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISCOUNT) || 'null');
        const storedDelivery = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELIVERY_METHOD) || '"scheduled"');
        const extras = {
          discountCode: storedDiscount,
          deliveryMethod: storedDelivery,
          deliveryZoneId: location?.id,
        };

        const pendingMerge = sessionStorage.getItem(STORAGE_KEYS.PENDING_CART_MERGE) === '1';
        if (pendingMerge) {
          sessionStorage.removeItem(STORAGE_KEYS.PENDING_CART_MERGE);
        }

        const { data: serverData } = await cartService.get({ params: extras });
        const serverItems = serverData.cart?.items || [];

        if (pendingMerge && guestItems.length > 0) {
          if (serverItems.length > 0) {
            const { data } = await cartService.merge(guestItems, extras);
            applyServerCart(data.cart);
          } else {
            const { data } = await cartService.sync({ items: guestItems, ...extras });
            applyServerCart(data.cart);
          }
        } else if (serverItems.length > 0) {
          applyServerCart(serverData.cart);
        } else if (guestItems.length > 0) {
          const { data } = await cartService.sync({ items: guestItems, ...extras });
          applyServerCart(data.cart);
        }
      } catch {
        // keep localStorage cart if API fails
      } finally {
        mergedRef.current = true;
        setSyncing(false);
      }
    };

    hydrate();
  }, [isAuthenticated, authLoading, setItems, setDiscountCode, setAppliedCoupon, setDeliveryMethod, location?.id]);

  useEffect(() => {
    if (!isAuthenticated) mergedRef.current = false;
  }, [isAuthenticated]);

  // Hydrate coupon details when only the code was stored (legacy / after refresh)
  useEffect(() => {
    if (!discountCode || appliedCoupon) return;

    const subtotal = calculateItemsSubtotal(items);
    let cancelled = false;

    validateCouponAsync(discountCode, subtotal).then((validation) => {
      if (cancelled) return;
      if (validation.valid && validation.coupon) {
        setAppliedCoupon(normalizeCoupon(validation.coupon));
        setDiscountError('');
      }
    });

    return () => { cancelled = true; };
  }, [discountCode, appliedCoupon, items, setAppliedCoupon]);

  // Re-check coupon when cart subtotal changes (min order rules)
  useEffect(() => {
    if (!discountCode || !appliedCoupon) return;

    if (skipCouponRevalidateRef.current) {
      skipCouponRevalidateRef.current = false;
      return;
    }

    const subtotal = calculateItemsSubtotal(items);
    const minSubtotal = appliedCoupon.minSubtotal || 0;

    if (subtotal < minSubtotal) {
      setDiscountError(
        isAr
          ? `الحد الأدنى للطلب ${minSubtotal} ج.م`
          : `Minimum order ${minSubtotal} EGP required`,
      );
      return;
    }

    setDiscountError('');
  }, [discountCode, appliedCoupon, items, isAr]);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((p) => !p);

  const showCartAddedToast = useCallback((product, totalQuantity) => {
    const template = isAr
      ? (settings?.cartToastAddedAr || 'تمت إضافة {{qty}} × {{name}} إلى السلة')
      : (settings?.cartToastAddedEn || 'Added {{qty}} × {{name}} to cart');
    const name = isAr ? (product?.name || '') : (product?.nameEn || product?.name || '');
    const message = template
      .replace(/\{\{\s*qty\s*\}\}/g, String(totalQuantity))
      .replace(/\{\{\s*name\s*\}\}/g, String(name).trim());
    toast.info(message, 2400);
  }, [isAr, settings?.cartToastAddedAr, settings?.cartToastAddedEn, toast]);

  const showStockLimitToast = useCallback((maxStock) => {
    toast.info(
      isAr
        ? `الحد الأقصى المتاح في المخزون: ${maxStock}`
        : `Maximum available in stock: ${maxStock}`,
      3500,
    );
  }, [isAr, toast]);

  const addItem = (product, quantity = 1, openDrawerOnAdd = true) => {
    const lastQuery = getLastSearchQuery();
    if (lastQuery) trackSearchConversion(lastQuery);

    const key = product.cartKey || itemKey({ productId: product._id || product.productId, variantId: product.variantId });
    const maxStock = getProductAvailableStock(product, product.variantId);
    const existing = items.find((item) => itemKey(item) === key);
    const requestedTotal = (existing?.quantity ?? 0) + quantity;

    const draftItem = normalizeItem(product, requestedTotal);
    const stockUnitsNeeded = getCartLineStockUnits(draftItem, requestedTotal);

    if (maxStock != null && maxStock <= 0) {
      toast.info(isAr ? 'المنتج غير متوفر في المخزون' : 'Product is out of stock', 3000);
      return;
    }

    let totalQuantity = requestedTotal;
    if (maxStock != null && stockUnitsNeeded > maxStock) {
      // Walk down paid qty until physical units fit stock (BOGO needs paid + free).
      totalQuantity = requestedTotal;
      while (totalQuantity > 0 && getCartLineStockUnits(draftItem, totalQuantity) > maxStock) {
        totalQuantity -= 1;
      }
      if (totalQuantity <= 0) {
        toast.info(isAr ? 'المنتج غير متوفر في المخزون' : 'Product is out of stock', 3000);
        return;
      }
      showStockLimitToast(maxStock);
    } else if (maxStock != null) {
      totalQuantity = clampQuantityToStock(requestedTotal, maxStock);
      if (totalQuantity < requestedTotal) showStockLimitToast(maxStock);
    }

    const addQty = existing ? totalQuantity - existing.quantity : totalQuantity;
    if (addQty <= 0) return;

    updateItems((prev) => {
      const prevExisting = prev.find((item) => itemKey(item) === key);
      if (prevExisting) {
        return prev.map((item) =>
          itemKey(item) === key
            ? { ...normalizeItem(product, totalQuantity), quantity: totalQuantity }
            : item,
        );
      }
      return [...prev, normalizeItem(product, addQty)];
    });
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    setBumpProductId(key);
    bumpTimer.current = setTimeout(() => setBumpProductId(null), 450);
    if (openDrawerOnAdd) openDrawer();

    try {
      const promo = getCartPromoBreakdown({ ...normalizeItem(product, totalQuantity), quantity: totalQuantity });
      if (promo?.freeQty > 0) {
        toast.success(
          isAr
            ? `تمت الإضافة — ${promo.paidQty} + ${promo.freeQty} هدية = ${promo.totalQty} قطع`
            : `Added — ${promo.paidQty} paid + ${promo.freeQty} free = ${promo.totalQty} items`,
          3200,
        );
      } else {
        showCartAddedToast(product, totalQuantity);
      }
    } catch {
      // ignore toast errors
    }
  };

  const removeItem = (cartKeyOrProductId) => {
    updateItems((prev) => prev.filter((item) => itemKey(item) !== cartKeyOrProductId && item.productId !== cartKeyOrProductId));
  };

  const updateQuantity = (cartKeyOrProductId, quantity) => {
    if (quantity <= 0) {
      removeItem(cartKeyOrProductId);
      return;
    }

    const current = items.find(
      (item) => itemKey(item) === cartKeyOrProductId || item.productId === cartKeyOrProductId,
    );
    const maxStock = current?.availableStock;
    let nextQty = quantity;

    if (maxStock != null && current) {
      while (nextQty > 0 && getCartLineStockUnits(current, nextQty) > maxStock) {
        nextQty -= 1;
      }
      if (nextQty < quantity) showStockLimitToast(maxStock);
    } else {
      nextQty = clampQuantityToStock(quantity, maxStock);
      if (maxStock != null && nextQty < quantity) showStockLimitToast(maxStock);
    }

    updateItems((prev) =>
      prev.map((item) =>
        (itemKey(item) === cartKeyOrProductId || item.productId === cartKeyOrProductId)
          ? { ...item, quantity: nextQty }
          : item,
      ),
    );
  };

  const clearCart = async () => {
    setItems([]);
    clearCoupon();
    if (isAuthenticated) {
      try {
        await cartService.clear();
      } catch {
        // ignore
      }
    }
  };

  const applyDiscountCode = useCallback(async (code) => {
    setDiscountError('');
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      setDiscountError(isAr ? 'أدخل كود الخصم' : 'Enter a discount code');
      return false;
    }

    const subtotal = calculateItemsSubtotal(items);

    try {
      const validation = await validateCouponAsync(trimmed, subtotal);
      if (!validation.valid || !validation.coupon) {
        setDiscountError(validation.message || (isAr ? 'كود خصم غير صالح' : 'Invalid discount code'));
        return false;
      }

      const upperCode = validation.coupon.code || trimmed.toUpperCase();
      skipCouponRevalidateRef.current = true;
      persistCoupon(upperCode, validation.coupon);

      if (isAuthenticated) {
        cartService.sync({
          items,
          discountCode: upperCode,
          deliveryMethod,
          deliveryZoneId: location?.id,
        }).then(() => cartService.applyDiscount(
          upperCode,
          subtotal,
          items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          { deliveryMethod, deliveryZoneId: location?.id },
        )).catch((err) => {
          console.warn('Coupon server sync failed:', err.response?.data?.message || err.message);
        });
      }

      return true;
    } catch {
      setDiscountError(isAr ? 'تعذر التحقق من الكود' : 'Could not validate code');
      return false;
    }
  }, [items, isAuthenticated, deliveryMethod, location?.id, isAr, persistCoupon]);

  const removeDiscountCode = async () => {
    clearCoupon();
    if (isAuthenticated) {
      try {
        await cartService.removeDiscount();
      } catch {
        // ignore
      }
    }
    scheduleSync(items, null, deliveryMethod);
  };

  const setDelivery = (method) => {
    setDeliveryMethod(method);
    if (isAuthenticated) scheduleSync(items, discountCode, method);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartPromoSummary = useMemo(
    () => summarizeCartOffers(items, isAr),
    [items, isAr],
  );

  const value = useMemo(
    () => ({
      items,
      totalItems,
      cartPromoSummary,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      discountAmount: totals.discountAmount,
      total: totals.total,
      appliedCoupon,
      freeDeliveryRemaining: totals.freeDeliveryRemaining,
      qualifiesForFreeDelivery: totals.qualifiesForFreeDelivery,
      thresholdMet: totals.thresholdMet,
      freeDeliveryMethods: totals.freeDeliveryMethods,
      freeDeliveryForCurrentMethod: totals.freeDeliveryForCurrentMethod,
      discountCode,
      discountError,
      deliveryMethod,
      isDrawerOpen,
      bumpProductId,
      syncing,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      applyDiscountCode,
      removeDiscountCode,
      setDeliveryMethod: setDelivery,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [
      items,
      totalItems,
      cartPromoSummary,
      totals,
      appliedCoupon,
      discountCode,
      discountError,
      deliveryMethod,
      isDrawerOpen,
      bumpProductId,
      syncing,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      applyDiscountCode,
      removeDiscountCode,
      setDelivery,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
