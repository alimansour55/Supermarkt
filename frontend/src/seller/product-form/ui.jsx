import { useState } from 'react';
import { X } from 'lucide-react';

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500';
export const errorInputCls = 'border-red-300 focus:border-red-500 focus:ring-red-100';

export function Field({ label, children, hint, error, counter, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium text-slate-800">
        <span>{label}</span>
        {counter && <span className="text-[11px] font-normal text-slate-400">{counter}</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function SectionHeader({ title, description, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Chips input: Enter or comma adds a tag, Backspace on empty removes the last one. */
export function TagInput({ value = [], onChange, placeholder, dir, max = 30 }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    parts.forEach((p) => { if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p); });
    onChange(next.slice(0, max));
    setDraft('');
  };
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-slate-400 hover:text-slate-700" aria-label={`Remove ${tag}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        dir={dir}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
      />
    </div>
  );
}
