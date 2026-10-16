import { KeyRound, ShieldAlert } from 'lucide-react';
import { CopyButton } from '../index';
import Button from '../../../components/ui/Button';

/** A key or secret shown once, with copy and a clear warning. */
export default function SecretReveal({ isAr, apiKey, webhookSecret, onDone }) {
  const rows = [
    apiKey && { label: isAr ? 'مفتاح الربط (API key)' : 'API key', value: apiKey },
    webhookSecret && { label: isAr ? 'سر توقيع الإشعارات (Webhook secret)' : 'Webhook signing secret', value: webhookSecret },
  ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {isAr
          ? 'انسخه الآن واحفظه في مكان آمن — لن نعرضه مرة أخرى. من يملك المفتاح يستطيع تغيير المخزون.'
          : 'Copy it now and keep it safe — it will not be shown again. Anyone with this key can change your stock.'}
      </p>
      {rows.map((row) => (
        <div key={row.label}>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            <KeyRound className="h-3.5 w-3.5" />
            {row.label}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-xs text-text">{row.value}</code>
            <CopyButton value={row.value} isAr={isAr} />
          </div>
        </div>
      ))}
      {onDone && (
        <Button size="sm" onClick={onDone}>
          {isAr ? 'نسخته، متابعة' : 'I copied it, continue'}
        </Button>
      )}
    </div>
  );
}
