import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, Clock, Copy, Gift, Link2, MousePointerClick, Pencil, Share2, ShoppingBag, Wallet, X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { affiliateService } from '../services/apiServices';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import { formatPrice } from '../utils/formatters';
import { isRefCode, withAffiliateRef } from '../utils/affiliateRef';

const STATUS_META = {
  pending: { ar: 'بانتظار التوصيل', en: 'Waiting for delivery', cls: 'bg-slate-100 text-slate-700' },
  holding: { ar: 'تحت المراجعة', en: 'In the return window', cls: 'bg-amber-50 text-amber-800' },
  paid: { ar: 'تمت الإضافة', en: 'Added', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { ar: 'أُلغي الطلب', en: 'Order cancelled', cls: 'bg-red-50 text-red-700' },
  reversed: { ar: 'استُرجعت', en: 'Taken back', cls: 'bg-red-50 text-red-700' },
};

function fmtDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function rewardText(amount, type, isAr) {
  if (type === 'points') return isAr ? `${amount} نقطة` : `${amount} points`;
  return formatPrice(amount);
}

function useCopy() {
  const toast = useToast();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [copied, setCopied] = useState('');
  const copy = useCallback(async (value, key = 'main') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(isAr ? 'تم نسخ الرابط' : 'Link copied');
      setTimeout(() => setCopied(''), 1600);
    } catch {
      toast.error(isAr ? 'تعذر النسخ — انسخ الرابط يدوياً' : 'Could not copy — copy the link by hand');
    }
  }, [toast, isAr]);
  return { copied, copy };
}

function Stat({ Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-text" dir="ltr">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function HowItWorks({ isAr, program }) {
  const steps = isAr
    ? [
      ['انسخ رابطك', 'رابط خاص بك — لأي صفحة أو منتج في المتجر.'],
      ['شاركه', 'أرسله لأصدقائك على واتساب أو فيسبوك أو أي مكان.'],
      ['اكسب', program.rewardType === 'points'
        ? 'عندما يشتري أحدهم ويُسلَّم طلبه تُضاف النقاط لحسابك.'
        : 'عندما يشتري أحدهم ويُسلَّم طلبه يُضاف المبلغ لمحفظتك.'],
    ]
    : [
      ['Copy your link', 'Your own link — to any page or product in the store.'],
      ['Share it', 'Send it to friends on WhatsApp, Facebook or anywhere.'],
      ['Earn', program.rewardType === 'points'
        ? 'When someone buys and the order is delivered, points land in your account.'
        : 'When someone buys and the order is delivered, money lands in your wallet.'],
    ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map(([title, body], i) => (
        <li key={title} className="rounded-2xl border border-border bg-white p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">{i + 1}</span>
          <p className="mt-2 text-sm font-bold text-text">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}

function RulesList({ isAr, program }) {
  const rules = [];
  rules.push(isAr
    ? `نتذكر رابطك ${program.attributionDays} يوماً من آخر مرة فتحه صديقك.`
    : `We remember your link for ${program.attributionDays} days after your friend last opened it.`);
  if (program.holdDays > 0) {
    rules.push(isAr
      ? `تُضاف المكافأة بعد ${program.holdDays} يوماً من التوصيل (مدة الإرجاع).`
      : `The reward is added ${program.holdDays} days after delivery (the return window).`);
  }
  if (program.minOrderTotal > 0) {
    rules.push(isAr
      ? `الطلب يجب أن يكون ${program.minOrderTotal} EGP أو أكثر (بدون رسوم التوصيل).`
      : `The order must be EGP ${program.minOrderTotal} or more (delivery not included).`);
  }
  if (program.newCustomersOnly) {
    rules.push(isAr ? 'فقط لأول طلب للعميل الجديد.' : 'Only for a new customer’s first order.');
  }
  rules.push(isAr
    ? 'طلباتك أنت من رابطك لا تُحتسب، والطلبات الملغاة أو المرتجعة لا تكسب مكافأة.'
    : 'Your own orders don’t count, and cancelled or returned orders earn nothing.');
  return (
    <ul className="space-y-1.5 text-xs leading-relaxed text-text-muted">
      {rules.map((r) => (
        <li key={r} className="flex gap-2"><span aria-hidden>•</span><span>{r}</span></li>
      ))}
      {program.terms && <li className="whitespace-pre-line pt-1">{program.terms}</li>}
    </ul>
  );
}

function CodeEditor({ isAr, code, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(code); setError(''); setEditing(true); }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {isAr ? 'غيّر الكود' : 'Change code'}
      </button>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isRefCode(value)) {
      setError(isAr ? 'من 4 إلى 20 حرفاً إنجليزياً أو رقماً' : '4–20 English letters or numbers');
      return;
    }
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={20}
          dir="ltr"
          className="w-full min-w-0 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold uppercase tracking-wide focus:border-primary-500 focus:outline-none"
          aria-label={isAr ? 'الكود الجديد' : 'New code'}
        />
        <Button type="submit" size="sm" loading={saving}>{isAr ? 'حفظ' : 'Save'}</Button>
        <button type="button" onClick={() => { setEditing(false); setValue(code); setError(''); }} className="rounded-full p-2 text-text-muted hover:bg-slate-100" aria-label={isAr ? 'إلغاء' : 'Cancel'}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className={`text-[11px] ${error ? 'text-red-600' : 'text-text-muted'}`}>
        {error || (isAr ? 'روابطك القديمة ستتوقف بعد تغيير الكود.' : 'Links you already shared stop working after you change it.')}
      </p>
    </form>
  );
}

function LinkMaker({ isAr, code }) {
  const { copied, copy } = useCopy();
  const [value, setValue] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const result = useMemo(() => {
    const raw = value.trim();
    if (!raw) return { link: '', error: '' };
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin) {
        return { link: '', error: isAr ? 'الصق رابطاً من هذا المتجر فقط' : 'Paste a link from this store only' };
      }
      return { link: withAffiliateRef(u.toString(), code), error: '' };
    } catch {
      return { link: '', error: isAr ? 'هذا ليس رابطاً صحيحاً' : 'That is not a valid link' };
    }
  }, [value, code, origin, isAr]);

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-text">
        <Link2 className="h-4 w-4 text-primary-600" aria-hidden />
        {isAr ? 'رابط لمنتج معيّن' : 'Link to a specific product'}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {isAr
          ? 'افتح أي منتج، انسخ رابطه من المتصفح والصقه هنا — نضيف كودك إليه.'
          : 'Open any product, copy its link from the browser and paste it here — we add your code to it.'}
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`${origin}/${isAr ? 'ar' : 'en'}/products/...`}
        dir="ltr"
        className="mt-3 w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        aria-label={isAr ? 'رابط المنتج' : 'Product link'}
      />
      {result.error && <p className="mt-1.5 text-xs text-red-600">{result.error}</p>}
      {result.link && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary-800" dir="ltr">{result.link}</span>
          <button type="button" onClick={() => copy(result.link, 'maker')} className="shrink-0 rounded-lg p-1.5 text-primary-700 hover:bg-primary-100" aria-label={isAr ? 'نسخ' : 'Copy'}>
            {copied === 'maker' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveLink({ isAr, language, data, onCodeChange }) {
  const { copied, copy } = useCopy();
  const { affiliate, stats, program, commissions } = data;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = withAffiliateRef(`${origin}/${language}`, affiliate.code);
  const shareText = isAr ? 'تسوّق معي من هنا 👇' : 'Shop with me here 👇';
  const waiting = (stats.pendingReward || 0) + (stats.holdingReward || 0);
  const unit = program.rewardType;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: link });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copy(link);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5">
        <p className="text-sm font-bold text-text">{isAr ? 'رابطك' : 'Your link'}</p>
        <p className="mt-1 text-sm text-text-muted">{program.description}</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text" dir="ltr">{link}</span>
          <button type="button" onClick={() => copy(link)} className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-text" aria-label={isAr ? 'نسخ' : 'Copy'}>
            {copied === 'main' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => copy(link)}>
            <Copy className="h-4 w-4" aria-hidden />
            {isAr ? 'نسخ الرابط' : 'Copy link'}
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95"
          >
            {isAr ? 'واتساب' : 'WhatsApp'}
          </a>
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden />
            {isAr ? 'مشاركة' : 'Share'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-primary-100 pt-3">
          <p className="text-xs text-text-muted">
            {isAr ? 'الكود:' : 'Code:'} <span className="font-bold tracking-wide text-text" dir="ltr">{affiliate.code}</span>
          </p>
          <CodeEditor isAr={isAr} code={affiliate.code} onSave={onCodeChange} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat Icon={MousePointerClick} label={isAr ? 'فتحوا رابطك' : 'Link opens'} value={affiliate.clicks} />
        <Stat Icon={ShoppingBag} label={isAr ? 'طلبات من رابطك' : 'Orders'} value={stats.orders} />
        <Stat
          Icon={Clock}
          label={isAr ? 'في الطريق إليك' : 'On the way'}
          value={rewardText(Math.round(waiting * 100) / 100, unit, isAr)}
          hint={isAr ? 'بعد التوصيل ومدة الإرجاع' : 'After delivery + return window'}
        />
        <Stat
          Icon={unit === 'points' ? Gift : Wallet}
          label={isAr ? 'ربحت' : 'Earned'}
          value={rewardText(stats.paidReward, unit, isAr)}
        />
      </section>

      <LinkMaker isAr={isAr} code={affiliate.code} />

      <section className="rounded-2xl border border-border bg-white p-4">
        <p className="text-sm font-bold text-text">{isAr ? 'مكافآتك' : 'Your rewards'}</p>
        {commissions.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            {isAr ? 'لا توجد طلبات من رابطك بعد — شاركه لتبدأ.' : 'No orders from your link yet — share it to get started.'}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {commissions.map((c) => {
              const meta = STATUS_META[c.status] || STATUS_META.pending;
              const struck = c.status === 'cancelled' || c.status === 'reversed';
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                      {isAr ? meta.ar : meta.en}
                    </span>
                    <p className="mt-1 text-xs text-text-muted">
                      {isAr ? 'طلب بقيمة' : 'Order of'} {formatPrice(c.baseAmount)} · {fmtDate(c.createdAt, isAr)}
                    </p>
                    {c.status === 'holding' && c.holdUntil && (
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {isAr ? 'تُضاف يوم' : 'Added on'} {fmtDate(c.holdUntil, isAr)}
                      </p>
                    )}
                  </div>
                  <p className={`shrink-0 font-bold tabular-nums ${struck ? 'text-text-muted line-through' : 'text-emerald-700'}`} dir="ltr">
                    +{rewardText(c.rewardAmount, c.rewardType, isAr)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <p className="mb-2 text-sm font-bold text-text">{isAr ? 'القواعد' : 'The rules'}</p>
        <RulesList isAr={isAr} program={program} />
      </section>
    </div>
  );
}

export default function ShareAndEarnPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(() => affiliateService.getMe(language)
    .then(({ data: res }) => { if (mounted.current) setData(res.data); })
    .catch(() => { if (mounted.current) setData(null); })
    .finally(() => { if (mounted.current) setLoading(false); }), [language]);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    setJoining(true);
    try {
      await affiliateService.join(language);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الانضمام' : 'Could not join'));
    } finally {
      if (mounted.current) setJoining(false);
    }
  };

  const changeCode = async (code) => {
    await affiliateService.update({ code }, language);
    toast.success(isAr ? 'تم تغيير الكود' : 'Code changed');
    await load();
  };

  const program = data?.program;
  const affiliate = data?.affiliate;

  let body;
  if (loading) {
    body = <div className="flex justify-center py-16"><Loader /></div>;
  } else if (!data) {
    body = <p className="text-sm text-text-muted">{isAr ? 'تعذر التحميل — حاول مرة أخرى.' : 'Could not load — please try again.'}</p>;
  } else if (!program.enabled && !affiliate) {
    body = (
      <p className="rounded-2xl border border-border bg-white p-5 text-sm text-text-muted">
        {isAr ? 'برنامج شارك واكسب غير متاح حالياً. ترقّب قريباً!' : 'Share & earn isn’t available right now. Check back soon!'}
      </p>
    );
  } else if (!affiliate) {
    body = (
      <div className="space-y-5">
        <section className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-6">
          <Gift className="h-8 w-8 text-primary-600" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-text">
            {isAr ? 'شارك المتجر مع أصدقائك واكسب' : 'Share the store with friends and earn'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{program.description}</p>
          <Button className="mt-4" onClick={join} loading={joining}>
            {isAr ? 'احصل على رابطي' : 'Get my link'}
          </Button>
          {program.joinMode === 'approval' && (
            <p className="mt-2 text-xs text-text-muted">
              {isAr ? 'سيراجع فريقنا طلبك ويفعّل رابطك.' : 'Our team reviews your request and turns your link on.'}
            </p>
          )}
        </section>
        <HowItWorks isAr={isAr} program={program} />
        <section className="rounded-2xl border border-border bg-white p-4">
          <p className="mb-2 text-sm font-bold text-text">{isAr ? 'القواعد' : 'The rules'}</p>
          <RulesList isAr={isAr} program={program} />
        </section>
      </div>
    );
  } else if (affiliate.status === 'active' && program.enabled) {
    body = <ActiveLink isAr={isAr} language={language} data={data} onCodeChange={changeCode} />;
  } else {
    const messages = {
      pending: isAr ? 'طلبك قيد المراجعة — سنخبرك عند تفعيل رابطك.' : 'Your request is being reviewed — we’ll let you know when your link is on.',
      paused: isAr ? 'رابطك متوقف مؤقتاً. تواصل مع خدمة العملاء لمعرفة السبب.' : 'Your link is paused. Contact customer support to find out why.',
      blocked: isAr ? 'تم إيقاف رابطك. تواصل مع خدمة العملاء.' : 'Your link has been turned off. Contact customer support.',
      rejected: isAr ? 'لم تتم الموافقة على طلبك. تواصل مع خدمة العملاء.' : 'Your request wasn’t approved. Contact customer support.',
      active: isAr ? 'البرنامج متوقف مؤقتاً — ستبقى مكافآتك المستحقة محفوظة.' : 'The program is paused for now — rewards you already earned are safe.',
    };
    body = (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {messages[affiliate.status] || messages.paused}
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">{isAr ? 'شارك واكسب' : 'Share & earn'}</h1>
      <div className="max-w-3xl">{body}</div>
    </div>
  );
}
