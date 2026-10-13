/**
 * Returns of a seller's items (read from Order.returns — staff still approve and refund),
 * the seller's note on a return, and payout statements.
 */
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import SellerPayout from '../models/SellerPayout.js';
import SellerLedgerEntry from '../models/SellerLedgerEntry.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v ?? ''));

/** order id → Map(itemIndex → shipment) for this seller's shipments. */
async function sellerLines(sellerId, orderIds) {
  const shipments = await Shipment.find({ seller: sellerId, order: { $in: orderIds } })
    .select('order shipmentNumber fulfilledBy items.itemIndex').lean();
  const byOrder = new Map();
  for (const s of shipments) {
    const lines = byOrder.get(String(s.order)) || new Map();
    s.items.forEach((it) => lines.set(it.itemIndex, s));
    byOrder.set(String(s.order), lines);
  }
  return byOrder;
}

function formatReturn(order, r, shipment) {
  return {
    _id: r._id,
    orderId: order._id,
    orderNumber: order.orderNumber,
    shipmentId: shipment._id,
    shipmentNumber: shipment.shipmentNumber,
    fulfilledBy: shipment.fulfilledBy,
    product: r.product,
    nameAr: r.nameAr,
    nameEn: r.nameEn,
    sku: r.sku,
    image: r.image,
    quantity: r.quantity,
    lineTotal: r.lineTotal,
    refundAmount: r.refundAmount || 0,
    reasonAr: r.reasonAr,
    reasonEn: r.reasonEn,
    customerNote: r.customerNote,
    itemCondition: r.itemCondition,
    returnMethod: r.returnMethod,
    status: r.status,
    fulfillmentStatus: r.fulfillmentStatus || '',
    adminNote: r.adminNote,
    sellerNote: r.sellerNote || '',
    sellerNoteAt: r.sellerNoteAt,
    requestedAt: r.requestedAt,
    reviewedAt: r.reviewedAt,
  };
}

export const listSellerReturns = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const orders = await Order.find({ sellerIds: sellerId, 'returns.0': { $exists: true } })
    .select('orderNumber returns').sort({ updatedAt: -1 }).limit(500).lean();
  const lines = await sellerLines(sellerId, orders.map((o) => o._id));

  let rows = [];
  for (const order of orders) {
    const mine = lines.get(String(order._id));
    if (!mine) continue;
    for (const r of order.returns || []) {
      const shipment = mine.get(r.itemIndex);
      if (shipment) rows.push(formatReturn(order, r, shipment));
    }
  }
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) rows = rows.filter((r) => r.status === req.query.status);
  rows.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  res.json({ success: true, data: rows, counts });
});

/** The seller's side of a return ("item was sealed when shipped", "please send photos"…). */
export const noteSellerReturn = asyncHandler(async (req, res) => {
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!note) throw new AppError('Write a note', 400);
  if (!isId(req.params.orderId) || !isId(req.params.returnId)) throw new AppError('Return not found', 404);
  const order = await Order.findOne({ _id: req.params.orderId, sellerIds: req.seller._id });
  const r = order?.returns?.id(req.params.returnId);
  if (!r) throw new AppError('Return not found', 404);
  const lines = await sellerLines(req.seller._id, [order._id]);
  const shipment = lines.get(String(order._id))?.get(r.itemIndex);
  if (!shipment) throw new AppError('Return not found', 404);

  r.sellerNote = note;
  r.sellerNoteAt = new Date();
  order.markModified('returns');
  await order.save({ validateBeforeSave: false });
  await logSellerActivity(req, { action: 'order.return_note', entityType: 'shipment', entityId: shipment._id, label: shipment.shipmentNumber, details: { note } });
  res.json({ success: true, data: formatReturn(order.toObject(), r.toObject(), shipment) });
});

// ── Payout statements ──

export const getPayoutStatement = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Payout not found', 404);
  const payout = await SellerPayout.findOne({ _id: req.params.id, seller: req.seller._id }).lean();
  if (!payout) throw new AppError('Payout not found', 404);
  const entries = await SellerLedgerEntry.find({ seller: req.seller._id, payout: payout._id, type: { $ne: 'payout' } })
    .sort({ availableAt: 1, createdAt: 1 }).lean();

  const totals = entries.reduce((acc, e) => ({ ...acc, [e.type]: Math.round(((acc[e.type] || 0) + e.amount) * 100) / 100 }), {});

  if (req.query.format === 'csv') {
    const csv = toCsv(entries, [
      { header: 'date', value: (e) => new Date(e.availableAt || e.createdAt).toISOString().slice(0, 10) },
      { header: 'type', value: (e) => e.type },
      { header: 'reference', value: (e) => e.reference || '' },
      { header: 'note', value: (e) => e.note || '' },
      { header: 'amount', value: (e) => e.amount },
    ]);
    return sendCsv(res, `statement-${payout.payoutNumber}.csv`, csv);
  }

  res.json({
    success: true,
    data: {
      payout: {
        _id: payout._id,
        payoutNumber: payout.payoutNumber,
        amount: payout.amount,
        status: payout.status,
        method: payout.method,
        referenceNumber: payout.referenceNumber,
        periodEnd: payout.periodEnd,
        createdAt: payout.createdAt,
        paidAt: payout.paidAt,
      },
      seller: {
        nameAr: req.seller.nameAr,
        nameEn: req.seller.nameEn,
        legalName: req.seller.legalName,
        taxId: req.seller.taxId,
        commercialRegisterNo: req.seller.commercialRegisterNo,
      },
      totals,
      entries: entries.map((e) => ({
        _id: e._id, type: e.type, amount: e.amount, reference: e.reference, note: e.note, date: e.availableAt || e.createdAt,
      })),
    },
  });
});
