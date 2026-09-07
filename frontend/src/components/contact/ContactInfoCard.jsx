import { Clock, Mail, MapPin, MessageCircle, Phone, Truck } from 'lucide-react';
import { buildContactQuickActions, normalizePhoneTel } from '../../utils/contactInfo';

export default function ContactInfoCard({ settings, isAr, className = '' }) {
  const phone = settings?.supportPhone;
  const email = settings?.supportEmail;
  const whatsapp = settings?.whatsappUrl;
  const promise = isAr ? settings?.deliveryPromiseAr : settings?.deliveryPromiseEn;
  const location = isAr ? settings?.defaultLocationAr : settings?.defaultLocationEn;
  const phoneTel = normalizePhoneTel(phone);
  const quickActions = buildContactQuickActions(settings, isAr);

  if (!phone && !email && !whatsapp) return null;

  return (
    <section className={`rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/80 to-white p-6 shadow-sm ${className}`}>
      <h2 className="mb-4 text-lg font-semibold text-text">
        {isAr ? 'بيانات التواصل' : 'Contact details'}
      </h2>
      <ul className="space-y-3 text-sm text-text">
        {phone && (
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
              <Phone className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text-muted">{isAr ? 'هاتف' : 'Phone'}</span>
              <a href={phoneTel} className="font-semibold text-primary-700 hover:underline">{phone}</a>
            </span>
          </li>
        )}
        {email && (
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text-muted">{isAr ? 'بريد إلكتروني' : 'Email'}</span>
              <a href={`mailto:${email}`} className="font-semibold text-primary-700 hover:underline">{email}</a>
            </span>
          </li>
        )}
        {whatsapp && (
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text-muted">WhatsApp</span>
              <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-primary-700 hover:underline">
                {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
              </a>
            </span>
          </li>
        )}
        {promise && (
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
              <Truck className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text-muted">{isAr ? 'وعد التوصيل' : 'Delivery promise'}</span>
              <span className="font-medium">{promise}</span>
            </span>
          </li>
        )}
        {location && (
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
              <MapPin className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text-muted">{isAr ? 'منطقة الخدمة' : 'Service area'}</span>
              <span className="font-medium">{location}</span>
            </span>
          </li>
        )}
        <li className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-primary-100">
            <Clock className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-xs font-semibold text-text-muted">{isAr ? 'ساعات العمل' : 'Hours'}</span>
            <span className="font-medium">{isAr ? 'على مدار الساعة' : '24/7'}</span>
          </span>
        </li>
      </ul>

      {quickActions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <a
              key={action.id}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noreferrer' : undefined}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                action.variant === 'primary'
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'border border-slate-200 bg-white text-primary-800 hover:border-primary-200 hover:bg-primary-50',
              ].join(' ')}
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
