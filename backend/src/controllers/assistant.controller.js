import { asyncHandler } from '../middleware/errorHandler.js';
import { chatWithAssistant, isAssistantEnabled } from '../services/assistant.service.js';
import { getAiChatEnabled } from '../services/storeSettings.service.js';

export const getAssistantStatus = asyncHandler(async (_req, res) => {
  const chatEnabled = await getAiChatEnabled();
  res.json({
    success: true,
    data: {
      enabled: chatEnabled && isAssistantEnabled(),
      chatEnabled,
      model: process.env.ASSISTANT_MODEL?.trim() || 'gpt-4o-mini',
    },
  });
});

export const postAssistantChat = asyncHandler(async (req, res) => {
  const { message, history = [], locale = 'ar' } = req.body;

  const result = await chatWithAssistant({
    message,
    history,
    locale: locale === 'en' ? 'en' : 'ar',
    user: req.user || null,
  });

  res.json({
    success: true,
    data: result,
  });
});
