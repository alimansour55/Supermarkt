import { useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  Headset,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  formatPhoneDisplay,
  getCustomerServiceChannels,
  normalizePhoneTel,
} from '../../utils/contactInfo';
import { useAuth } from '../../context/AuthContext';
import { useSupportChat } from '../../context/SupportChatContext';
import CallbackRequestModal from '../support/CallbackRequestModal';
import { SOCIAL_PATHS } from '../layout/regions/socialPaths';

function BrandIcon({ path, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d={path} />
    </svg>
  );
}

/** Every channel type gets its own icon + accent color, so a five-option grid
 *  reads as five distinct, equally-weighted choices rather than a ranked list. */
const CHANNEL_STYLE = {
  phone: { icon: Phone, bg: 'bg-primary-50', text: 'text-primary-600', hoverBg: 'group-hover:bg-primary-600' },
  email: { icon: Mail, bg: 'bg-sky-50', text: 'text-sky-600', hoverBg: 'group-hover:bg-sky-600' },
  whatsapp: { icon: MessageCircle, bg: 'bg-emerald-50', text: 'text-emerald-600', hoverBg: 'group-hover:bg-emerald-600' },
  callback: { icon: PhoneCall, bg: 'bg-amber-50', text: 'text-amber-600', hoverBg: 'group-hover:bg-amber-600' },
  chat: { icon: Headset, bg: 'bg-violet-50', text: 'text-violet-600', hoverBg: 'group-hover:bg-violet-600' },
  custom: { icon: ArrowUpRight, bg: 'bg-slate-100', text: 'text-slate-600', hoverBg: 'group-hover:bg-slate-600' },
};

function resolveChannelLink(ch, isAr) {
  switch (ch.type) {
    case 'phone': {
      const href = normalizePhoneTel(ch.value);
      return href ? { href, displayValue: formatPhoneDisplay(ch.value) } : null;
    }
    case 'email':
      return ch.value ? { href: `mailto:${ch.value}`, displayValue: ch.value } : null;
    case 'whatsapp':
      return ch.value ? { href: ch.value, external: true, displayValue: isAr ? 'متاح الآن' : 'Available now' } : null;
    case 'callback':
      return { href: '#', displayValue: null };
    case 'chat':
      return { href: '#', displayValue: null };
    case 'custom':
      return ch.value ? { href: ch.value, external: true, displayValue: null } : null;
    default:
      return null;
  }
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-text-muted">{label}</span>
        <span className="block truncate text-sm font-bold text-text">{value}</span>
      </span>
    </div>
  );
}

export default function ContactInfoCard({ settings, isAr, className = '' }) {
  const { user } = useAuth();
  const { openHumanChat } = useSupportChat();
  const [callbackOpen, setCallbackOpen] = useState(false);

  const liveChat = settings?.liveChat;

  const channelCards = getCustomerServiceChannels(settings, isAr)
    .filter((ch) => ch.type !== 'chat' || liveChat?.enabled !== false)
    .map((ch) => {
      const resolved = resolveChannelLink(ch, isAr);
      return resolved ? { ...ch, ...resolved } : null;
    })
    .filter(Boolean);

  const deliveryPromise = isAr ? settings?.deliveryPromiseAr : settings?.deliveryPromiseEn;
  const serviceArea = isAr ? settings?.defaultLocationAr : settings?.defaultLocationEn;
  const socialEntries = Object.entries(settings?.socialLinks || {}).filter(([, href]) => href);

  const callbackNote = isAr
    ? settings?.customerService?.callback?.noteAr
    : settings?.customerService?.callback?.noteEn;

  const handleChannelClick = (ch, e) => {
    if (ch.type === 'callback') {
      e.preventDefault();
      setCallbackOpen(true);
      return;
    }
    if (ch.type === 'chat') {
      e.preventDefault();
      openHumanChat();
    }
  };

  if (!channelCards.length) return null;

  return (
    <section className={className} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mb-3 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100 sm:gap-2 sm:px-3 sm:py-1 sm:text-xs">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
            {isAr ? 'خدمة العملاء' : 'Customer service'}
          </span>
          <h1 className="mt-1.5 text-xl font-extrabold text-text sm:mt-3 sm:text-2xl lg:text-3xl">
            {isAr ? 'اتصل بنا' : 'Get in touch'}
          </h1>
          <p className="mt-2 hidden max-w-lg text-sm leading-relaxed text-text-muted sm:block sm:text-base">
            {isAr
              ? 'اختار الطريقة الأنسب لك من الوسائل دي — فريقنا جاهز يرد عليك في أي وقت.'
              : "Pick whichever channel suits you best — our team is ready to answer any time."}
          </p>
        </div>
        {liveChat?.scheduleEnabled !== true && (
          <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text shadow-sm sm:flex">
            <Clock className="h-4 w-4 text-primary-600" aria-hidden />
            {isAr ? 'متاحين على مدار الساعة' : 'Available 24/7'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
        {channelCards.map((ch) => {
          const style = CHANNEL_STYLE[ch.type] || CHANNEL_STYLE.custom;
          const Icon = style.icon;
          return (
            <a
              key={ch.id}
              href={ch.href}
              target={ch.external ? '_blank' : undefined}
              rel={ch.external ? 'noreferrer' : undefined}
              onClick={(e) => handleChannelClick(ch, e)}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg sm:gap-4 sm:rounded-2xl sm:p-5"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${style.bg} ${style.text} transition ${style.hoverBg} group-hover:text-white sm:h-11 sm:w-11 sm:rounded-xl`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                  {ch.type === 'chat' && liveChat && (
                    <span
                      className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                        liveChat.available !== false ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      aria-hidden
                    />
                  )}
                </span>
                <ArrowUpRight
                  className="hidden h-4 w-4 text-text-muted/50 transition group-hover:text-primary-600 rtl:-scale-x-100 sm:block"
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-xs font-bold text-text sm:text-sm">{ch.label}</p>
                {ch.type === 'chat' && liveChat ? (
                  <p className={`mt-0.5 truncate text-[11px] font-semibold sm:mt-1 sm:text-sm ${liveChat.available !== false ? 'text-emerald-600' : 'text-text-muted'}`}>
                    {liveChat.available !== false
                      ? (isAr ? 'متاح الآن' : 'Available now')
                      : (isAr ? 'غير متاح الآن' : 'Offline right now')}
                  </p>
                ) : ch.displayValue && (
                  <p dir="ltr" className="mt-0.5 truncate text-[11px] font-semibold text-primary-700 sm:mt-1 sm:text-sm">
                    {ch.displayValue}
                  </p>
                )}
                {ch.type === 'chat' ? (
                  <p className="mt-1 hidden text-xs leading-relaxed text-text-muted sm:block">
                    {isAr ? 'تحدث مباشرة مع فريق الدعم' : 'Talk directly with our support team'}
                  </p>
                ) : ch.description && (
                  <p className="mt-1 hidden text-xs leading-relaxed text-text-muted sm:block">{ch.description}</p>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {(deliveryPromise || serviceArea) && (
        <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2">
          {deliveryPromise && (
            <InfoPill icon={Truck} label={isAr ? 'وعد التوصيل' : 'Delivery promise'} value={deliveryPromise} />
          )}
          {serviceArea && (
            <InfoPill icon={MapPin} label={isAr ? 'منطقة الخدمة' : 'Service area'} value={serviceArea} />
          )}
        </div>
      )}

      {socialEntries.length > 0 && (
        <div className="mt-4 hidden flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-4 sm:flex">
          <span className="text-sm font-semibold text-text-muted">{isAr ? 'تابعنا على' : 'Follow us'}</span>
          <div className="flex flex-wrap gap-2">
            {socialEntries.map(([key, href]) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={key}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 transition hover:bg-primary-600 hover:text-white"
              >
                <BrandIcon path={SOCIAL_PATHS[key] || SOCIAL_PATHS.linkedin} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      )}

      {callbackOpen && (
        <CallbackRequestModal
          isAr={isAr}
          user={user}
          note={callbackNote}
          source="contact_page"
          onClose={() => setCallbackOpen(false)}
        />
      )}
    </section>
  );
}
