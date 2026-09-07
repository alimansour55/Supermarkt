import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';

export default function HomepageAppDownload({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const links = settings?.appLinks || {};
  const appStore = links.appStore?.trim();
  const googlePlay = links.googlePlay?.trim();
  const appGallery = links.appGallery?.trim();

  if (!appStore && !googlePlay && !appGallery) return null;

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;

  return (
    <section className="container-app py-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            {section.icon && <span className="mb-2 block text-3xl" aria-hidden>{section.icon}</span>}
            <h2 className="text-xl font-bold md:text-2xl">
              {title || (isAr ? 'حمّل تطبيقنا' : 'Download our app')}
            </h2>
            {subtitle && <p className="mt-2 text-sm text-slate-300">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {appStore && (
              <a
                href={appStore}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-950"
              >
                App Store
              </a>
            )}
            {googlePlay && (
              <a
                href={googlePlay}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-950"
              >
                Google Play
              </a>
            )}
            {appGallery && (
              <a
                href={appGallery}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-950"
              >
                AppGallery
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
