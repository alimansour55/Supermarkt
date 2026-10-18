import { useState } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import api from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useHomepagePreview } from './homepagePreviewContext';
import { whatsappHref } from '../../utils/homepageBlocks';

/** Email sign-up form, a "Join on WhatsApp" button, or both. */
export default function HomepageSignupBlock({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const preview = useHomepagePreview();
  const cfg = section.blockConfig || {};
  const mode = cfg.signupMode || 'newsletter';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | already | error
  const [error, setError] = useState('');

  const showEmail = mode !== 'whatsapp';
  const waMessage = isAr ? cfg.whatsappMessageAr || cfg.whatsappMessageEn : cfg.whatsappMessageEn || cfg.whatsappMessageAr;
  const waLink = mode !== 'newsletter' ? whatsappHref(cfg.whatsappNumber, waMessage) : '';
  if (!showEmail && !waLink) return null;

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const button = (isAr ? section.ctaLabelAr : section.ctaLabelEn) || (isAr ? 'اشترك' : 'Sign up');
  const privacy = isAr ? cfg.privacyNoteAr || cfg.privacyNoteEn : cfg.privacyNoteEn || cfg.privacyNoteAr;

  const submit = async (event) => {
    event.preventDefault();
    if (preview || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const { data } = await api.post('/homepage-sections/newsletter', { email, language, sectionId: section._id });
      setStatus(data.data?.alreadySubscribed ? 'already' : 'done');
    } catch (err) {
      setStatus('error');
      setError(err?.response?.status === 400
        ? (isAr ? 'اكتب بريداً إلكترونياً صحيحاً.' : 'Please enter a valid email address.')
        : (isAr ? 'تعذّر الاشتراك الآن — حاول لاحقاً.' : 'Could not sign you up right now — please try again later.'));
    }
  };

  const finished = status === 'done' || status === 'already';

  return (
    <section className="container-app py-6">
      <div className="flex flex-col gap-5 rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-6 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
        <div className="min-w-0 md:max-w-md">
          {title && <h2 className="text-xl font-black text-text md:text-2xl">{title}</h2>}
          {subtitle && <p className="mt-2 text-sm text-text-muted">{subtitle}</p>}
        </div>
        <div className="w-full space-y-3 md:max-w-md">
          {showEmail && (finished ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
              {status === 'already'
                ? (isAr ? 'أنت مشترك بالفعل — شكراً لك!' : 'You are already signed up — thank you!')
                : (isAr ? 'تم الاشتراك! سنرسل لك أفضل العروض.' : 'You’re in! We’ll send you the best deals.')}
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor={`signup-${section._id}`}>{isAr ? 'البريد الإلكتروني' : 'Email address'}</label>
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  id={`signup-${section._id}`}
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAr ? 'بريدك الإلكتروني' : 'Your email'}
                  className="w-full rounded-full border border-border bg-white py-3 pe-4 ps-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <button type="submit" disabled={status === 'sending'} className="rounded-full bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">
                {status === 'sending' ? (isAr ? 'جارٍ…' : 'Sending…') : button}
              </button>
            </form>
          ))}
          {error && <p className="text-xs text-danger-600" role="alert">{error}</p>}
          {showEmail && privacy && !finished && <p className="text-xs text-text-muted">{privacy}</p>}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white hover:bg-[#1ebe5a]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {isAr ? 'انضم عبر واتساب' : 'Join on WhatsApp'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
