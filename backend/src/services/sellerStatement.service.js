/**
 * A seller's monthly statement (every ledger line posted in a Cairo month, with totals) and the
 * matching tax invoice for the marketplace's fees. Both read the append-only ledger, so they
 * always agree with balances and payouts.
 */
import mongoose from 'mongoose';
import SellerLedgerEntry from '../models/SellerLedgerEntry.js';
import StoreSettings from '../models/StoreSettings.js';
import { AppError } from '../utils/AppError.js';
import { statementTotals, cairoMonthRange } from '../utils/sellerStatement.js';

export async function monthlyStatement(seller, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new AppError('Choose a month (YYYY-MM)', 400);
  const { from, to } = cairoMonthRange(month);
  const id = new mongoose.Types.ObjectId(String(seller._id));
  const [entries, opening, store] = await Promise.all([
    SellerLedgerEntry.find({ seller: id, createdAt: { $gte: from, $lt: to } }).sort({ createdAt: 1 }).lean(),
    SellerLedgerEntry.aggregate([{ $match: { seller: id, createdAt: { $lt: from } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    StoreSettings.findOne({ key: 'main' }).select('invoice storeNameAr storeNameEn logoUrl').lean(),
  ]);
  const totals = statementTotals(entries);
  const openingBalance = Math.round((opening[0]?.total || 0) * 100) / 100;
  const inv = store?.invoice || {};
  return {
    month,
    from,
    to,
    seller: {
      _id: seller._id,
      nameAr: seller.nameAr,
      nameEn: seller.nameEn,
      legalName: seller.legalName || '',
      taxId: seller.taxId || '',
      commercialRegisterNo: seller.commercialRegisterNo || '',
      address: seller.address || {},
    },
    issuer: {
      nameAr: inv.companyNameAr || store?.storeNameAr || '',
      nameEn: inv.companyNameEn || store?.storeNameEn || '',
      addressAr: inv.companyAddressAr || '',
      addressEn: inv.companyAddressEn || '',
      taxId: inv.taxRegistrationNumber || '',
      logoUrl: store?.logoUrl || '',
    },
    // Deterministic, so the same month always prints the same number.
    invoiceNumber: `SF-${String(seller.slug || seller._id).toUpperCase().slice(0, 16)}-${month.replace('-', '')}`,
    openingBalance,
    closingBalance: Math.round((openingBalance + totals.net) * 100) / 100,
    totals,
    entries: entries.map((e) => ({
      _id: e._id,
      date: e.createdAt,
      type: e.type,
      amount: e.amount,
      reference: e.reference || '',
      note: e.note || '',
      availableAt: e.availableAt,
    })),
  };
}
