import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import CheckoutChoiceModal from '../components/checkout/CheckoutChoiceModal';
import { useStoreSettings } from './StoreSettingsContext';

const SupportChatContext = createContext(null);

export function SupportChatProvider({ children }) {
  const { settings } = useStoreSettings();
  const aiChatEnabled = settings?.aiChatEnabled !== false;
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutPrompt, setCheckoutPrompt] = useState(null);
  const [launchCheckoutAi, setLaunchCheckoutAi] = useState(false);
  const [launchHumanChat, setLaunchHumanChat] = useState(false);

  const openChat = useCallback(() => {
    if (!aiChatEnabled) return;
    setIsOpen(true);
  }, [aiChatEnabled]);
  const closeChat = useCallback(() => setIsOpen(false), []);

  const openHumanChat = useCallback(() => {
    if (!aiChatEnabled) return;
    setLaunchHumanChat(true);
    setIsOpen(true);
  }, [aiChatEnabled]);

  const consumeLaunchHumanChat = useCallback(() => {
    if (!launchHumanChat) return false;
    setLaunchHumanChat(false);
    return true;
  }, [launchHumanChat]);

  const promptCheckout = useCallback((options = {}) => {
    if (!aiChatEnabled) {
      options.onManual?.();
      return;
    }
    setCheckoutPrompt({
      onManual: options.onManual || null,
      source: options.source || 'cart',
    });
  }, [aiChatEnabled]);

  const chooseAiCheckout = useCallback(() => {
    if (!aiChatEnabled) return;
    setCheckoutPrompt(null);
    setLaunchCheckoutAi(true);
    setIsOpen(true);
  }, [aiChatEnabled]);

  const chooseManualCheckout = useCallback(() => {
    const onManual = checkoutPrompt?.onManual;
    setCheckoutPrompt(null);
    onManual?.();
  }, [checkoutPrompt]);

  const cancelCheckoutPrompt = useCallback(() => {
    setCheckoutPrompt(null);
  }, []);

  const consumeLaunchCheckoutAi = useCallback(() => {
    if (!launchCheckoutAi) return false;
    setLaunchCheckoutAi(false);
    return true;
  }, [launchCheckoutAi]);

  const value = useMemo(() => ({
    isOpen,
    setIsOpen,
    openChat,
    closeChat,
    openHumanChat,
    promptCheckout,
    chooseAiCheckout,
    chooseManualCheckout,
    cancelCheckoutPrompt,
    checkoutPrompt,
    consumeLaunchCheckoutAi,
    consumeLaunchHumanChat,
  }), [
    isOpen,
    openChat,
    closeChat,
    openHumanChat,
    promptCheckout,
    chooseAiCheckout,
    chooseManualCheckout,
    cancelCheckoutPrompt,
    checkoutPrompt,
    consumeLaunchCheckoutAi,
    consumeLaunchHumanChat,
  ]);

  return (
    <SupportChatContext.Provider value={value}>
      {children}
      {checkoutPrompt && aiChatEnabled && (
        <CheckoutChoiceModal
          source={checkoutPrompt.source}
          onAi={chooseAiCheckout}
          onManual={chooseManualCheckout}
          onClose={cancelCheckoutPrompt}
        />
      )}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error('useSupportChat must be used within SupportChatProvider');
  return ctx;
}
