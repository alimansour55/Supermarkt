import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listPartnerPayouts,
  getPartnerPayoutSummary,
  generatePayoutsFromPeriod,
  createManualPartnerPayout,
  updatePartnerPayout,
  setPartnerPayoutStatus,
  deletePartnerPayout,
  buildPayoutBatchRows,
} from '../services/partnerPayout.service.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export const getPartnerPayoutsHandler = asyncHandler(async (req, res) => {
  const data = await listPartnerPayouts(req.query);
  res.json({ success: true, data: data.items, pagination: data.pagination });
});

export const getPartnerPayoutSummaryHandler = asyncHandler(async (_req, res) => {
  const data = await getPartnerPayoutSummary();
  res.json({ success: true, data });
});

export const generatePartnerPayoutsHandler = asyncHandler(async (req, res) => {
  const data = await generatePayoutsFromPeriod(req.body, req.user);
  res.json({ success: true, data });
});

export const createPartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await createManualPartnerPayout(req.body, req.user);
  res.status(201).json({ success: true, data });
});

export const updatePartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await updatePartnerPayout(req.params.id, req.body);
  res.json({ success: true, data });
});

export const setPartnerPayoutStatusHandler = asyncHandler(async (req, res) => {
  const data = await setPartnerPayoutStatus(req.params.id, req.body, req.user);
  res.json({ success: true, data });
});

export const deletePartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await deletePartnerPayout(req.params.id);
  res.json({ success: true, data });
});

export const exportPartnerPayoutsHandler = asyncHandler(async (req, res) => {
  const rows = await buildPayoutBatchRows(req.query);
  if (String(req.query.format || 'csv') === 'json') {
    res.json({ success: true, data: rows });
    return;
  }
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="partner-payout-batch-${Date.now()}.csv"`);
  res.send(`﻿${csv}`);
});
