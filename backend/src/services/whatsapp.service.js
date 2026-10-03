import crypto from 'crypto';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Send a plain text message through the WhatsApp Cloud API. Throws on API errors. */
export async function sendWhatsAppText(toDigits, text) {
  if (!isWhatsAppConfigured()) throw new Error('WhatsApp is not configured');
  const to = String(toDigits || '').replace(/\D/g, '');
  if (!to) throw new Error('Missing recipient');
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: String(text).slice(0, 4000) },
      }),
    },
  );
  if (!res.ok) throw new Error(`WhatsApp send failed (${res.status})`);
  return res.json();
}

/** Validate Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyWhatsAppSignature(rawBody, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!rawBody || !header) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
