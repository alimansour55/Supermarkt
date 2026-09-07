import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const STYLES = {
  accent: 'border-primary-200 bg-primary-50 text-primary-900',
  minimal: 'border-border bg-surface-muted/60 text-text',
  bold: 'border-primary-600 bg-primary-600 text-white',
};

function styleClass(layout) {
  return STYLES[layout] || STYLES.accent;
}

function buildMessages(section, isAr) {
  const config = section.announcementConfig || {};
  if (config.mode === 'rotate' && Array.isArray(section.items) && section.items.length > 0) {
    return section.items
      .map((item) => ({
        id: item._id || item.titleEn,
        icon: item.emoji || '',
        text: isAr ? item.titleAr || item.titleEn : item.titleEn || item.titleAr,
        link: item.link || '',
        cta: '',
      }))
      .filter((m) => m.text);
  }
  const text = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  if (!text) return [];
  return [{
    id: 'single',
    icon: section.icon || '',
    badge: isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr,
    text,
    link: section.link || '',
    cta: isAr ? section.ctaLabelAr || 'المزيد ←' : section.ctaLabelEn || 'Learn more →',
  }];
}

function BarContent({ message, layout, isAr, onDismiss, dismissible }) {
  const styleClassName = styleClass(layout);
  const isBold = layout === 'bold';
  const inner = (
    <div className={`relative flex w-full flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-semibold sm:px-6 sm:py-3 ${styleClassName}`}>
      {message.icon && <span className="text-base shrink-0" aria-hidden>{message.icon}</span>}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {message.badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isBold ? 'bg-white/20' : 'bg-primary-100 text-primary-800'}`}>
            {message.badge}
          </span>
        )}
        <span>{message.text}</span>
        {message.link && message.cta && layout !== 'bold' && (
          <span className="text-xs font-bold underline underline-offset-2 opacity-90">{message.cta}</span>
        )}
      </div>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
          className={`absolute top-1/2 -translate-y-1/2 rounded p-1 opacity-70 hover:opacity-100 ${isAr ? 'left-2' : 'right-2'}`}
          aria-label={isAr ? 'إغلاق' : 'Dismiss'}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (message.link) {
    return <Link to={message.link} className="block w-full">{inner}</Link>;
  }
  return inner;
}

export default function HomepageAnnouncementStrip({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const config = section.announcementConfig || {};
  const layout = section.layout || 'accent';
  const visible = section.announcementVisible !== false && section.isActive !== false;
  const dismissKey = section._id ? `announcement-dismiss-${section._id}` : 'announcement-dismiss';
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);

  const messages = useMemo(() => buildMessages(section, isAr), [section, isAr]);
  const rotate = config.mode === 'rotate' && messages.length > 1;
  const current = messages[index] || messages[0];

  useEffect(() => {
    if (!config.dismissible || !section._id) return undefined;
    try {
      if (localStorage.getItem(dismissKey) === '1') setDismissed(true);
    } catch { /* ignore */ }
    return undefined;
  }, [config.dismissible, dismissKey, section._id]);

  useEffect(() => {
    if (!rotate) return undefined;
    const ms = Math.min(20, Math.max(3, Number(config.rotateSeconds) || 6)) * 1000;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ms);
    return () => clearInterval(timer);
  }, [rotate, messages.length, config.rotateSeconds]);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
  };

  if (!visible || dismissed || !current) return null;

  const bar = (
    <BarContent
      message={current}
      layout={layout}
      isAr={isAr}
      dismissible={config.dismissible}
      onDismiss={handleDismiss}
    />
  );

  if (config.sticky) {
    return (
      <div className="sticky top-0 z-40 w-full border-b border-black/5 shadow-sm">
        {bar}
      </div>
    );
  }

  return (
    <section className="container-app py-2">
      <div className="overflow-hidden rounded-xl border border-black/5 shadow-sm">
        {bar}
      </div>
    </section>
  );
}
