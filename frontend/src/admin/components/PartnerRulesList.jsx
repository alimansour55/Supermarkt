import { useMemo, useState } from 'react';
import {
  Plus, Copy, ArrowUp, ArrowDown, ChevronDown, ChevronUp, AlertTriangle, FlaskConical, Zap,
} from 'lucide-react';
import PartnerRuleEditor from './PartnerRuleEditor';
import { emptyRule, summarizeRule, describeRate } from '../constants/partnerRuleMeta';
import { partnerColor } from './PartnerPercentageBar';

function partnerKeyOf(p) {
  if (p.userId) return String(p.userId);
  if (p._id) return String(p._id);
  return null;
}

function RuleCard({
  rule, index, total, isAr, canEdit, partners, catalog, onChange, onRemove, onMove, onDuplicate,
}) {
  const [open, setOpen] = useState(!rule._id);
  const beneNames = (rule.beneficiaries || []).map((b) => {
    const p = partners.find((x) => partnerKeyOf(x) === b.partnerKey);
    return { name: isAr ? (p?.nameAr || p?.nameEn) : (p?.nameEn || p?.nameAr) || b.partnerKey, share: b.sharePercent };
  });

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-slate-50/70 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-bold text-text">
            {rule.name || (isAr ? 'قاعدة بدون اسم' : 'Untitled rule')}
            {rule.enabled === false && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                {isAr ? 'معطّلة' : 'off'}
              </span>
            )}
            {rule.source === 'auto' && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                {isAr ? 'تلقائي' : 'auto'}
              </span>
            )}
            {rule.stackable && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                {isAr ? 'تراكمي' : 'stack'}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-text-muted">
            {describeRate(rule, isAr)} · {summarizeRule(rule, isAr)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {beneNames.slice(0, 3).map((b, bi) => (
            <span key={bi} className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white ${partnerColor(bi)}`}
              title={`${b.name} ${b.share}%`}>
              {(b.name || '?').charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5">
            <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)}
              className="rounded p-1.5 text-text-muted hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)}
              className="rounded p-1.5 text-text-muted hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            {rule.source !== 'auto' && (
              <button type="button" onClick={() => onDuplicate(index)}
                className="rounded p-1.5 text-text-muted hover:bg-white"><Copy className="h-4 w-4" /></button>
            )}
          </div>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded p-1.5 text-text-muted hover:bg-white">
          {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="p-4">
          <PartnerRuleEditor
            rule={rule} onChange={onChange} onRemove={onRemove}
            isAr={isAr} canEdit={canEdit} partners={partners} catalog={catalog}
          />
        </div>
      )}
    </div>
  );
}

export default function PartnerRulesList({
  rules = [], onChange, isAr, canEdit, partners = [], catalog = {},
  warnings = [], onSimulate, simulating, simResult,
}) {
  const eligiblePartners = useMemo(
    () => partners.filter((p) => partnerKeyOf(p) && (p.nameAr || p.nameEn || p.userId)),
    [partners],
  );

  const updateRule = (index, next) => {
    const list = [...rules];
    list[index] = next;
    onChange(list);
  };
  const removeRule = (index) => onChange(rules.filter((_, i) => i !== index));
  const moveRule = (index, dir) => {
    const list = [...rules];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    onChange(list.map((r, i) => ({ ...r, priority: (i + 1) * 10 })));
  };
  const duplicateRule = (index) => {
    const src = rules[index];
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      _id: null,
      source: 'manual',
      sourcePartnerKey: '',
      name: `${src.name || 'Rule'} (copy)`,
    };
    const list = [...rules];
    list.splice(index + 1, 0, copy);
    onChange(list);
  };
  const addRule = () => {
    const firstKey = partnerKeyOf(eligiblePartners[0] || {});
    onChange([...rules, { ...emptyRule(firstKey), priority: (rules.length + 1) * 10 }]);
  };

  const errors = warnings.filter((w) => w.level === 'error');
  const softWarnings = warnings.filter((w) => w.level !== 'error');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text">{isAr ? 'قواعد تخصيص الإيراد' : 'Revenue attribution rules'}</h2>
          <p className="max-w-2xl text-sm text-text-muted">
            {isAr
              ? 'تُقيَّم بالترتيب من الأعلى للأسفل. أول قاعدة غير تراكمية تطابق طلباً/سطراً «تستهلكه» فلا تطابقه القواعد التالية. المبلغ غير المخصص يُوزَّع حسب نسب الشركاء.'
              : 'Evaluated top to bottom. The first non-stackable rule that matches an order/line "consumes" it. Unassigned revenue splits by partner pool %.'}
          </p>
        </div>
        <div className="flex gap-2">
          {onSimulate && (
            <button type="button" onClick={onSimulate} disabled={simulating}
              className="inline-flex items-center gap-2 rounded-xl border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-100 disabled:opacity-60">
              <FlaskConical className={`h-4 w-4 ${simulating ? 'animate-pulse' : ''}`} />
              {isAr ? 'محاكاة' : 'Simulate'}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={addRule} disabled={!eligiblePartners.length}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              <Plus className="h-4 w-4" />
              {isAr ? 'قاعدة جديدة' : 'New rule'}
            </button>
          )}
        </div>
      </div>

      {!eligiblePartners.length && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isAr ? 'أضف شركاء أولاً من تبويب «الشركاء».' : 'Add partners first in the Partners tab.'}
        </p>
      )}

      {(errors.length > 0 || softWarnings.length > 0) && (
        <div className="space-y-2">
          {errors.map((w, i) => (
            <p key={`e${i}`} className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {isAr ? w.messageAr : w.messageEn}
            </p>
          ))}
          {softWarnings.map((w, i) => (
            <p key={`w${i}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {isAr ? w.messageAr : w.messageEn}
            </p>
          ))}
        </div>
      )}

      {simResult && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-primary-900">
            <Zap className="h-4 w-4" />
            {isAr ? 'نتيجة المحاكاة' : 'Simulation result'}
            <span className="text-xs font-normal text-primary-700">
              {simResult.summary?.totalOrders} {isAr ? 'طلب' : 'orders'} ·{' '}
              {isAr ? 'مخصص' : 'attributed'} {Math.round(simResult.attributionSummary?.totalAttributed || 0).toLocaleString()}
            </span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-muted">
                <tr>
                  <th className="px-2 py-1.5 text-start">{isAr ? 'القاعدة' : 'Rule'}</th>
                  <th className="px-2 py-1.5 text-start">{isAr ? 'طلبات' : 'Orders'}</th>
                  <th className="px-2 py-1.5 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-2 py-1.5 text-start">{isAr ? 'المستفيدون' : 'Beneficiaries'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {(simResult.ruleBreakdown || []).map((r) => (
                  <tr key={r.ruleId}>
                    <td className="px-2 py-1.5 font-medium">{r.name}</td>
                    <td className="px-2 py-1.5">{r.matchedOrders}</td>
                    <td className="px-2 py-1.5 font-semibold text-emerald-700">{Math.round(r.amount).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-xs text-text-muted">
                      {Object.entries(r.byPartner || {}).map(([k, v]) => {
                        const p = partners.find((x) => partnerKeyOf(x) === k);
                        return `${isAr ? (p?.nameAr || p?.nameEn || k) : (p?.nameEn || p?.nameAr || k)}: ${Math.round(v).toLocaleString()}`;
                      }).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(simResult.partners || []).map((p, i) => (
              <span key={p.partnerId || i} className="rounded-lg border border-primary-200 bg-white px-2.5 py-1 text-xs font-semibold">
                {isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}: {Math.round(p.amount).toLocaleString()} ({p.sharePercent}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border py-14 text-center">
          <Zap className="mx-auto h-10 w-10 text-text-muted/30" />
          <p className="mt-3 font-semibold text-text">{isAr ? 'لا توجد قواعد بعد' : 'No rules yet'}</p>
          <p className="mt-1 text-sm text-text-muted">
            {isAr ? 'أنشئ قاعدة لتوجيه إيراد طلبات/مناطق/منتجات معيّنة لشريك محدد' : 'Create a rule to route revenue from specific orders/areas/products to a partner'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <RuleCard
              key={rule._id || `new-${index}`}
              rule={rule} index={index} total={rules.length}
              isAr={isAr} canEdit={canEdit} partners={eligiblePartners} catalog={catalog}
              onChange={(next) => updateRule(index, next)}
              onRemove={() => removeRule(index)}
              onMove={moveRule}
              onDuplicate={duplicateRule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
