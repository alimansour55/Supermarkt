import { useMemo } from 'react';
import { AlertTriangle, Map, User } from 'lucide-react';
import { partnerColor } from './PartnerPercentageBar';

const SCOPE_LABELS = {
  products: { ar: 'منتج', en: 'Product' },
  categories: { ar: 'قسم', en: 'Category' },
  brands: { ar: 'علامة', en: 'Brand' },
  deliveryZones: { ar: 'منطقة', en: 'Zone' },
  fulfillmentLocations: { ar: 'موقع شحن', en: 'Location' },
  users: { ar: 'عميل', en: 'Customer' },
  promotions: { ar: 'عرض', en: 'Promotion' },
};

function resolveLabel(itemId, scopeType, catalog, isAr) {
  const lists = {
    products: catalog.products || [],
    categories: catalog.categories || [],
    brands: catalog.brands || [],
    deliveryZones: catalog.deliveryZones || [],
    fulfillmentLocations: catalog.fulfillmentLocations || [],
    users: catalog.users || [],
    promotions: catalog.promotions || [],
  };
  const list = lists[scopeType] || [];
  const item = list.find((x) => String(x._id || x.id) === String(itemId));
  if (!item) return itemId?.slice(-6) || '—';

  if (scopeType === 'deliveryZones') {
    return isAr ? (item.areaAr || item.areaEn) : (item.areaEn || item.areaAr);
  }
  if (scopeType === 'users') {
    return item.name || item.username || item.email || itemId;
  }
  if (scopeType === 'promotions') {
    return isAr ? (item.nameAr || item.nameEn) : (item.nameEn || item.nameAr);
  }
  return isAr
    ? (item.nameAr || item.nameEn || item.name || item.slug)
    : (item.nameEn || item.nameAr || item.name || item.slug);
}

export default function PartnerAssignmentMap({
  partners = [],
  conflicts = [],
  catalog = {},
  isAr,
}) {
  const assignments = useMemo(() => {
    const rows = [];
    for (let i = 0; i < partners.length; i += 1) {
      const p = partners[i];
      if (p.isActive === false) continue;
      const partnerKey = p.userId || p._id || `idx-${i}`;
      const name = isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr);
      const scopes = p.scopes || {};
      for (const [scopeType, ids] of Object.entries(scopes)) {
        for (const id of ids || []) {
          rows.push({
            scopeType,
            itemId: String(id),
            partnerKey: String(partnerKey),
            partnerName: name || partnerKey,
            partnerIndex: i,
          });
        }
      }
    }
    return rows.sort((a, b) => a.scopeType.localeCompare(b.scopeType));
  }, [partners, isAr]);

  const conflictSet = useMemo(() => {
    const set = new Set();
    for (const c of conflicts) {
      set.add(`${c.scopeType}:${c.itemId}`);
    }
    return set;
  }, [conflicts]);

  const byPartner = useMemo(() => {
    const map = {};
    for (const row of assignments) {
      if (!map[row.partnerKey]) {
        map[row.partnerKey] = { name: row.partnerName, index: row.partnerIndex, items: [] };
      }
      map[row.partnerKey].items.push(row);
    }
    return map;
  }, [assignments]);

  if (!assignments.length && !conflicts.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-slate-50/50 px-6 py-12 text-center">
        <Map className="mx-auto h-10 w-10 text-text-muted/40" />
        <p className="mt-3 font-medium text-text">
          {isAr ? 'لا توجد تخصيصات بعد' : 'No assignments yet'}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {isAr
            ? 'عيّن منتجات أو مناطق أو عملاء لكل شريك — سيظهرون هنا'
            : 'Assign products, zones, or customers per partner — they will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="flex items-center gap-2 font-bold text-red-800">
            <AlertTriangle className="h-5 w-5" />
            {isAr
              ? `${conflicts.length} تعارض — نفس العنصر مُعيَّن لأكثر من شريك`
              : `${conflicts.length} conflict(s) — same item assigned to multiple partners`}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {conflicts.slice(0, 8).map((c) => (
              <li key={`${c.scopeType}-${c.itemId}`}>
                {isAr ? c.labelAr : c.labelEn}: {resolveLabel(c.itemId, c.scopeType, catalog, isAr)}
                {' → '}
                {c.owners.map((o) => o.name).join(', ')}
              </li>
            ))}
            {conflicts.length > 8 && (
              <li className="text-red-600">
                {isAr ? `+${conflicts.length - 8} أخرى` : `+${conflicts.length - 8} more`}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(byPartner).map(([key, group]) => (
          <div key={key} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white ${partnerColor(group.index)}`}>
                {(group.name || '?').charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-text">{group.name}</p>
                <p className="text-xs text-text-muted">
                  {group.items.length} {isAr ? 'تخصيص' : 'assignment(s)'}
                </p>
              </div>
            </div>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {group.items.map((item) => {
                const conflict = conflictSet.has(`${item.scopeType}:${item.itemId}`);
                const typeLabel = isAr
                  ? SCOPE_LABELS[item.scopeType]?.ar
                  : SCOPE_LABELS[item.scopeType]?.en;
                return (
                  <li
                    key={`${item.scopeType}-${item.itemId}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${conflict ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-text'}`}
                  >
                    <span className="truncate font-medium">
                      {resolveLabel(item.itemId, item.scopeType, catalog, isAr)}
                    </span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${conflict ? 'bg-red-200' : 'bg-white text-text-muted'}`}>
                      {typeLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {assignments.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'العنصر' : 'Item'}</th>
                <th className="px-4 py-3 text-start">{isAr ? 'الشريك' : 'Partner'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assignments.map((row) => {
                const conflict = conflictSet.has(`${row.scopeType}:${row.itemId}`);
                return (
                  <tr key={`${row.scopeType}-${row.itemId}-${row.partnerKey}`} className={conflict ? 'bg-red-50/50' : ''}>
                    <td className="px-4 py-2.5 text-text-muted">
                      {isAr ? SCOPE_LABELS[row.scopeType]?.ar : SCOPE_LABELS[row.scopeType]?.en}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {resolveLabel(row.itemId, row.scopeType, catalog, isAr)}
                      {conflict && <AlertTriangle className="ms-1 inline h-3.5 w-3.5 text-red-500" />}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-text-muted" />
                        {row.partnerName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
