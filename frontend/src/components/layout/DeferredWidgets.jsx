import { Suspense, lazy, useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useSupportChat } from '../../context/SupportChatContext';

/*
 * Heavy storefront widgets that aren't needed for the first paint. Keeping them out
 * of the Layout chunk saves ~200 KB of JavaScript on every page:
 * - cart drawer: mounted the first time it opens
 * - location popup: mounted when it has to show
 * - support chat: mounted once the page is idle (or immediately if opened)
 * Their code is prefetched when the browser is idle so opening them is instant.
 */
const loadCartDrawer = () => import('../cart/CartDrawer');
const loadSupportChat = () => import('../support/SupportChatWidget');
const loadLocationGate = () => import('../location/LocationGateModal');

const CartDrawer = lazy(loadCartDrawer);
const SupportChatWidget = lazy(loadSupportChat);
const LocationGateModal = lazy(loadLocationGate);

function useIdle(timeout = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const done = () => setIdle(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(done, { timeout });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(done, 1500);
    return () => clearTimeout(timer);
  }, [timeout]);
  return idle;
}

/** Becomes true the first time `active` is true and stays true (keeps close animations working). */
function useSticky(active) {
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  return seen || active;
}

export default function DeferredWidgets({ showLocationGate }) {
  const { isDrawerOpen } = useCart();
  const { isOpen: chatOpen } = useSupportChat();
  const idle = useIdle();
  const cartMounted = useSticky(isDrawerOpen);
  const gateMounted = useSticky(showLocationGate);
  const chatMounted = useSticky(idle || chatOpen);

  useEffect(() => {
    if (!idle) return;
    loadCartDrawer().catch(() => {});
    loadLocationGate().catch(() => {});
  }, [idle]);

  return (
    <>
      {cartMounted && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
      {chatMounted && (
        <Suspense fallback={null}>
          <SupportChatWidget />
        </Suspense>
      )}
      {gateMounted && (
        <Suspense fallback={null}>
          <LocationGateModal open={showLocationGate} />
        </Suspense>
      )}
    </>
  );
}
