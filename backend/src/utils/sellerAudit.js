/**
 * "What changed" on a seller record, for the staff audit log and the seller's change history.
 * Pure — takes two plain snapshots (before / after save) and returns { field: { from, to } }.
 * Bank details are never written out in full: only that they changed (masked tail).
 */

/** Fields staff care about, grouped so the history can label them. */
export const SELLER_AUDIT_FIELDS = [
  'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'legalName', 'commercialRegisterNo', 'taxId',
  'contactName', 'email', 'phone',
  'address.street', 'address.city', 'address.governorate',
  'commissionRate', 'categoryCommissions', 'feePlan',
  'feeOverrides.minCommissionPerItem', 'feeOverrides.maxCommissionPerItem', 'feeOverrides.fixedFeePerItem',
  'feeOverrides.fixedFeePerShipment', 'feeOverrides.storeFulfillmentFeePerItem', 'feeOverrides.monthlyFee',
  'feeOverrides.payoutHoldDays', 'feeOverrides.commissionFreeUntil', 'feeOverrides.vatExempt', 'feeOverrides.payoutFrequency',
  'allowedFulfillment', 'defaultFulfillment', 'deliveryZones', 'handlingDays', 'autoApproveListings',
  'vacation.enabled', 'logoUrl', 'bannerUrl',
];

const BANK_FIELDS = ['bankName', 'accountName', 'accountNumber', 'iban', 'walletPhone'];
const MASKED = new Set(['accountNumber', 'iban']);

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Comparable form: ids → strings, dates → ISO, empty → null, lists of rules sorted. */
export function normalizeAuditValue(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) {
    const out = v.map((x) => (x && typeof x === 'object' && !(x instanceof Date) && !x._bsontype
      ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== '_id').map(([k, val]) => [k, normalizeAuditValue(val)]))
      : normalizeAuditValue(x)));
    return out.length ? out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : null;
  }
  if (typeof v === 'object' && (v._bsontype || typeof v.toHexString === 'function')) return String(v);
  return v;
}

const maskTail = (v) => (v ? `••••${String(v).slice(-4)}` : null);

export function sellerChanges(before = {}, after = {}) {
  const changes = {};
  for (const field of SELLER_AUDIT_FIELDS) {
    const from = normalizeAuditValue(get(before, field));
    const to = normalizeAuditValue(get(after, field));
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  for (const f of BANK_FIELDS) {
    const from = normalizeAuditValue(get(before, `bank.${f}`));
    const to = normalizeAuditValue(get(after, `bank.${f}`));
    if (from !== to) changes[`bank.${f}`] = MASKED.has(f) ? { from: maskTail(from), to: maskTail(to) } : { from, to };
  }
  return changes;
}

/** Fee-related keys, so the history can show "deal changes" on their own. */
export const isFeeField = (field) => /^(commissionRate|categoryCommissions|feePlan|feeOverrides\.)/.test(field);
