import { asyncHandler } from '../middleware/errorHandler.js';
import { getLoyaltySettings, buildLoyaltySummary, pointsToCashValue } from '../services/loyalty.service.js';

const formatHistory = (entry) => ({
  id: entry._id,
  type: entry.type,
  points: entry.points,
  order: entry.order,
  amount: entry.amount,
  note: entry.note,
  expiresAt: entry.expiresAt,
  createdAt: entry.createdAt,
});

export const getMyLoyalty = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const rules = await getLoyaltySettings();
  const summary = buildLoyaltySummary(rules, lang);
  const pointsBalance = req.user.pointsBalance || 0;
  const history = [...(req.user.pointsHistory || [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50)
    .map(formatHistory);

  res.json({
    success: true,
    pointsBalance,
    cashbackValue: pointsToCashValue(pointsBalance, rules),
    history,
    rules: {
      ...rules,
      ...summary,
    },
  });
});
