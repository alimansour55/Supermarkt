/**
 * Pure helpers for seller monthly statements and fee invoices (tested without a database).
 *
 * Ledger amounts are signed from the seller's side (+ the marketplace owes the seller), so a
 * fee is negative and a fee refund on a return is positive.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Fee types the marketplace invoices the seller for (VAT is shown on its own line). */
export const INVOICED_FEE_TYPES = ['commission', 'commission_reversal', 'fixed_fee', 'fulfillment_fee', 'payment_fee', 'subscription_fee'];

/** [from, to) instants of a Cairo calendar month 'YYYY-MM'. */
export function cairoMonthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = (yy, mm) => {
    // Midnight in Cairo: try UTC+2 and UTC+3 and keep the one that is midnight there.
    for (const offset of [2, 3]) {
      const t = new Date(Date.UTC(yy, mm - 1, 1, -offset));
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(t));
      if (hour === 0) return t;
    }
    return new Date(Date.UTC(yy, mm - 1, 1, -2));
  };
  const from = start(y, m);
  const to = m === 12 ? start(y + 1, 1) : start(y, m + 1);
  return { from, to };
}

export function statementTotals(entries = []) {
  const byType = {};
  let net = 0;
  for (const e of entries) {
    byType[e.type] = round2((byType[e.type] || 0) + e.amount);
    net += e.amount;
  }
  // Fees as positive amounts the seller paid (reversals reduce them).
  const fees = round2(-INVOICED_FEE_TYPES.reduce((s, t) => s + (byType[t] || 0), 0));
  const vat = round2(-(byType.fee_vat || 0));
  return {
    byType,
    sales: round2((byType.sale || 0) + (byType.delivery_fee || 0)),
    returns: round2(-(byType.return || 0)),
    fees,
    vat,
    feesWithVat: round2(fees + vat),
    penalties: round2(-(byType.penalty || 0)),
    adjustments: round2(byType.adjustment || 0),
    cashCollected: round2(-(byType.cod_collected || 0)),
    paidOut: round2(-(byType.payout || 0)),
    net: round2(net),
    // Invoice lines: one per fee type that has an amount this month.
    invoiceLines: INVOICED_FEE_TYPES
      .map((t) => ({ type: t, amount: round2(-(byType[t] || 0)) }))
      .filter((l) => l.amount !== 0),
  };
}

/** Statement rows → CSV-ready objects (date in Cairo, signed amounts). */
export function statementCsvRows(statement) {
  const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(d));
  return [
    { date: '', type: 'opening_balance', reference: '', note: '', amount: statement.openingBalance },
    ...statement.entries.map((e) => ({ date: day(e.date), type: e.type, reference: e.reference, note: e.note, amount: e.amount })),
    { date: '', type: 'closing_balance', reference: '', note: '', amount: statement.closingBalance },
  ];
}
