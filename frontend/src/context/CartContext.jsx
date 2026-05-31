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
import { calculateCartTotals, validateCoupon } from '../utils/cartCalculations';
import { cartService } from '../services/cartService';

const CartContext = createContext(null);

function normalizeItem(product, quantity = 1) {
  return {
    productId: product._id || product.productId,
    slug: product.slug,
    name: product.name,
    nameEn: product.nameEn,
    price: product.price,
    emoji: product.emoji,
    image: product.image,
    quantity,
  };
}

export function CartProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useLocalStorage(STORAGE_KEYS.CART, []);
  const [discountCode, setDiscountCode] = useLocalStorage(STORAGE_KEYS.DISCOUNT, null);
  const [deliveryMethod, setDeliveryMethod] = useLocalStorage(STORAGE_KEYS.DELIVERY_METHOD, 'scheduled');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bumpProductId, setBumpProductId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const bumpTimer = useRef(null);
  const [discountError, setDiscountError] = useState('');
  const syncTimer = useRef(null);
  const mergedRef = useRef(false);

  const totals = useMemo(
    () => calculateCartTotals({ items, deliveryMethod, discountCode }),
    [items, deliveryMethod, discountCode],
  );

  const persistToServer = useCallback(async (nextItems, nextDiscount, nextDelivery) => {
    if (!isAuthenticated) return;
    try {
      await cartService.sync({
        items: nextItems,
        discountCode: nextDiscount,
        deliveryMethod: nextDelivery,
      });
    } catch (err) {
      console.error('Cart sync failed:', err);
    }
  }, [isAuthenticated]);

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

  // Merge guest cart on login
  useEffect(() => {
    if (authLoading || !isAuthenticated || mergedRef.current) return;

    const merge = async () => {
      setSyncing(true);
      try {
        const guestItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
        if (guestItems.length > 0) {
          const { data } = await cartService.merge(guestItems);
          if (data.cart?.items) {
            setItems(data.cart.items);
            if (data.cart.discountCode) setDiscountCode(data.cart.discountCode);
            if (data.cart.deliveryMethod) setDeliveryMethod(data.cart.deliveryMethod);
          }
        } else {
          const { data } = await cartService.get();
          if (data.cart?.items?.length) {
            setItems(data.cart.items);
            if (data.cart.discountCode) setDiscountCode(data.cart.discountCode);
            if (data.cart.deliveryMethod) setDeliveryMethod(data.cart.deliveryMethod);
          }
        }
      } catch {
        // keep localStorage cart if API fails
      } finally {
        mergedRef.current = true;
        setSyncing(false);
      }
    };

    merge();
  }, [isAuthenticated, authLoading, setItems, setDiscountCode, setDeliveryMethod]);

  useEffect(() => {
    if (!isAuthenticated) mergedRef.current = false;
  }, [isAuthenticated]);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((p) => !p);

  const addItem = (product, quantity = 1, openDrawerOnAdd = true) => {
    const id = product._id || product.productId;
    updateItems((prev) => {
      const existing = prev.find((item) => item.productId === id);
      if (existing) {
        return prev.map((item) =>
          item.productId === id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...prev, normalizeItem(product, quantity)];
    });
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    setBumpProductId(id);
    bumpTimer.current = setTimeout(() => setBumpProductId(null), 450);
    if (openDrawerOnAdd) openDrawer();
  };

  const removeItem = (productId) => {
    updateItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    updateItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    );
  };

  const clearCart = async () => {
    setItems([]);
    setDiscountCode(null);
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
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const validation = validateCoupon(code, subtotal);
    if (!validation.valid) {
      setDiscountError(validation.message);
      return false;
    }
    const upperCode = code.toUpperCase();
    setDiscountCode(upperCode);
    if (isAuthenticated) {
      try {
        await cartService.applyDiscount(code);
      } catch (err) {
        setDiscountError(err.response?.data?.message || 'Failed to apply code');
        setDiscountCode(null);
        return false;
      }
    }
    scheduleSync(items, upperCode, deliveryMethod);
    return true;
  }, [items, isAuthenticated, deliveryMethod, setDiscountCode, scheduleSync]);

  const removeDiscountCode = async () => {
    setDiscountCode(null);
    setDiscountError('');
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

  const value = useMemo(
    () => ({
      items,
      totalItems,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      discountAmount: totals.discountAmount,
      total: totals.total,
      appliedCoupon: totals.appliedCoupon,
      freeDeliveryRemaining: totals.freeDeliveryRemaining,
      qualifiesForFreeDelivery: totals.qualifiesForFreeDelivery,
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
      totals,
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
