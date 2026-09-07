import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_POLL_MS = 4000;

function messagesFingerprint(msgs) {
  if (!msgs?.length) return '0';
  const last = msgs[msgs.length - 1];
  return `${msgs.length}:${last._id || ''}:${last.createdAt || ''}`;
}

/**
 * Live order chat: polls for new messages and applies send responses immediately.
 */
export function useOrderChat({
  orderId,
  initialMessages = [],
  fetchMessages,
  sendMessageFn,
  pollMs = DEFAULT_POLL_MS,
  enabled = true,
  onMessagesChange,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sending, setSending] = useState(false);
  const fingerprintRef = useRef(messagesFingerprint(initialMessages));

  useEffect(() => {
    const next = initialMessages || [];
    fingerprintRef.current = messagesFingerprint(next);
    setMessages(next);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const next = initialMessages || [];
    const fp = messagesFingerprint(next);
    if (fp === fingerprintRef.current) return;
    fingerprintRef.current = fp;
    setMessages(next);
  }, [orderId, initialMessages]);

  const applyMessages = useCallback((next) => {
    const fp = messagesFingerprint(next);
    if (fp === fingerprintRef.current) return;
    fingerprintRef.current = fp;
    setMessages(next);
    onMessagesChange?.(next);
  }, [onMessagesChange]);

  useEffect(() => {
    if (!enabled || !orderId || !fetchMessages) return undefined;

    let cancelled = false;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const next = await fetchMessages();
        if (!cancelled) applyMessages(next);
      } catch {
        /* ignore transient poll errors */
      }
    };

    poll();
    const timer = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, enabled, fetchMessages, pollMs, applyMessages]);

  const send = useCallback(async (payload) => {
    if (!sendMessageFn) return;
    setSending(true);
    try {
      const next = await sendMessageFn(payload);
      applyMessages(next);
      return next;
    } finally {
      setSending(false);
    }
  }, [sendMessageFn, applyMessages]);

  return { messages, sending, send, setMessages: applyMessages };
}
