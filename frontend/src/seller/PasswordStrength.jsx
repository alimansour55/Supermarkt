/** Same rule as the API: 8+ characters with letters and digits. */
export function passwordIsStrong(p) {
  return String(p || '').length >= 8 && /[A-Za-z؀-ۿ]/.test(p) && /\d/.test(p);
}

/** Live checklist under a new-password field. */
export default function PasswordStrength({ value, isAr }) {
  const p = String(value || '');
  const rules = [
    { ok: p.length >= 8, ar: '8 أحرف على الأقل', en: '8+ characters' },
    { ok: /[A-Za-z؀-ۿ]/.test(p), ar: 'حروف', en: 'letters' },
    { ok: /\d/.test(p), ar: 'أرقام', en: 'numbers' },
  ];
  const score = rules.filter((r) => r.ok).length + (p.length >= 12 ? 1 : 0) + (/[^A-Za-z0-9؀-ۿ]/.test(p) ? 1 : 0);
  const tone = score >= 5 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? tone : 'bg-slate-200'}`} />)}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
        {rules.map((r) => <li key={r.en} className={r.ok ? 'text-emerald-600' : 'text-slate-400'}>{r.ok ? '✓' : '•'} {isAr ? r.ar : r.en}</li>)}
      </ul>
    </div>
  );
}
