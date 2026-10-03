import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from './index';

export default function CopyButton({ value, label, isAr, className = '' }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      toast.success(isAr ? 'تم النسخ' : 'Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(isAr ? 'تعذر النسخ' : 'Could not copy');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text ${className}`}
      title={label || (isAr ? 'نسخ' : 'Copy')}
      aria-label={label || (isAr ? 'نسخ' : 'Copy')}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
