import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyWhatsAppSignature } from '../services/whatsapp.service.js';
import { receiveWhatsAppMessage } from './supportConversation.controller.js';

/** Meta webhook verification handshake. */
export const verifyWebhook = (req, res) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
};

/** Incoming customer messages. Always answers 200 quickly so Meta does not retry. */
export const receiveWebhook = asyncHandler(async (req, res) => {
  if (!verifyWhatsAppSignature(req.rawBody, req.get('x-hub-signature-256'))) {
    return res.sendStatus(403);
  }
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        if (msg.type !== 'text' || !msg.text?.body) continue;
        try {
          await receiveWhatsAppMessage({ phone: msg.from, text: msg.text.body });
        } catch (err) {
          console.error('WhatsApp inbound failed:', err.message);
        }
      }
    }
  }
  return res.sendStatus(200);
});
