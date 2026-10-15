import { CheckCircle2, MessageCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { CopyButton, useToast } from '../index';
import { sellerInviteMessage } from '../../utils/sellerAdmin';

function UrlLine({ label, url, isAr }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-muted">{label}</p>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-xs">{url}</code>
        <CopyButton value={url} isAr={isAr} />
      </div>
    </div>
  );
}

/**
 * What staff see after emailing a seller their sign-in details: the links themselves plus a
 * ready-made message for WhatsApp, because seller email often lands in spam.
 */
export default function SellerAccessResult({ access, storeName, isAr }) {
  const toast = useToast();
  if (!access) return null;
  const message = sellerInviteMessage({ storeName, email: access.sentTo, loginUrl: access.loginUrl, setupUrl: access.setupUrl });

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(isAr ? 'تم نسخ الرسالة — الصقها في واتساب' : 'Message copied — paste it into WhatsApp');
    } catch {
      toast.error(isAr ? 'تعذر النسخ' : 'Could not copy');
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="flex items-start gap-2 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {isAr ? 'أرسلنا رسالة إلى ' : 'We emailed '}
          <strong dir="ltr">{access.sentTo}</strong>
          {access.setupUrl
            ? (isAr ? ' فيها رابط لاختيار كلمة المرور (صالح ٧٢ ساعة).' : ' a link to choose their password (valid 72 hours).')
            : (isAr ? ' فيها رابط الدخول.' : ' with the sign-in link.')}
        </span>
      </p>
      {access.setupUrl && <UrlLine label={isAr ? 'رابط اختيار كلمة المرور' : 'Set-password link'} url={access.setupUrl} isAr={isAr} />}
      <UrlLine label={isAr ? 'رابط الدخول' : 'Sign-in link'} url={access.loginUrl} isAr={isAr} />
      <Button type="button" size="sm" variant="outline" onClick={copyMessage} className="gap-1.5">
        <MessageCircle className="h-4 w-4" />
        {isAr ? 'نسخ رسالة جاهزة لواتساب' : 'Copy message for WhatsApp'}
      </Button>
    </div>
  );
}
