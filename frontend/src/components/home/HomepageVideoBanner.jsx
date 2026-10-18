import { useState } from 'react';
import { ChevronLeft, Play } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { useHydrated } from '../ui/ClientOnly';
import useIsMobile from '../../hooks/useIsMobile';
import { VIDEO_ASPECT_CLASS, youtubeEmbedSrc, youtubePoster } from '../../utils/homepageBlocks';

/**
 * MP4 or YouTube video with a cover image. Plays by itself (muted, looping) on
 * computers only; phones see the cover and tap to play, which saves mobile
 * data. The server renders the cover only, so hydration always matches.
 */
export default function HomepageVideoBanner({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [tapped, setTapped] = useState(false);
  const cfg = section.blockConfig || {};
  const youtubeId = cfg.youtubeId || '';
  const videoUrl = cfg.videoUrl || '';
  if (!youtubeId && !videoUrl) return null;

  const autoplay = hydrated && !isMobile && cfg.autoplayDesktop !== false;
  const playing = tapped || autoplay;
  const poster = cfg.posterImage || youtubePoster(youtubeId);
  const aspect = VIDEO_ASPECT_CLASS[cfg.aspect] || VIDEO_ASPECT_CLASS['16:9'];
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const cta = isAr ? section.ctaLabelAr || section.ctaLabelEn : section.ctaLabelEn || section.ctaLabelAr;
  const hasText = Boolean(title || subtitle || (cta && section.link));

  let media = null;
  if (playing && youtubeId) {
    media = (
      <iframe
        title={title || 'Video'}
        src={youtubeEmbedSrc(youtubeId, { autoplay: !tapped })}
        className={`absolute inset-0 h-full w-full border-0 ${tapped ? '' : 'pointer-events-none'}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  } else if (playing && videoUrl) {
    media = (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={videoUrl}
        poster={poster || undefined}
        autoPlay
        muted={!tapped}
        loop={!tapped}
        playsInline
        controls={tapped}
        preload="metadata"
      />
    );
  }

  return (
    <section className="container-app py-4">
      <div className={`relative w-full overflow-hidden rounded-3xl bg-slate-900 shadow-sm ${aspect}`}>
        {media || (
          <button
            type="button"
            onClick={() => setTapped(true)}
            className="group absolute inset-0 flex h-full w-full items-center justify-center"
            aria-label={isAr ? 'تشغيل الفيديو' : 'Play video'}
          >
            {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg transition group-hover:scale-105">
              <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" aria-hidden />
            </span>
          </button>
        )}
        {/* Computers: text over the video while it plays muted. Phones: below it, clear of the play button. */}
        {hasText && !tapped && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/70 via-black/30 to-transparent p-8 text-white sm:block">
            {title && <h2 className="text-xl font-black md:text-3xl">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-xl text-sm text-white/85 md:text-base">{subtitle}</p>}
            {cta && section.link && (
              <Link to={section.link} className="pointer-events-auto mt-3 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-white/90">
                {cta}
                <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>
      {hasText && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 sm:hidden">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-black text-text">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
          </div>
          {cta && section.link && (
            <Link to={section.link} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">
              {cta}
              <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
