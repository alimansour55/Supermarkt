import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export default function HomepageSidebarBanners({ section, banners = [] }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (!banners.length) return null;

  return (
    <section className="container-app py-4">
      {(section.titleAr || section.titleEn) && (
        <h2 className="mb-3 text-lg font-bold text-text md:text-xl">
          {isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr}
        </h2>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {banners.map((banner) => (
          <Link
            key={banner._id || banner.id}
            to={banner.link || '/products'}
            className="relative h-28 w-44 shrink-0 overflow-hidden rounded-xl shadow-sm sm:h-32 sm:w-52"
          >
            {banner.image ? (
              <img src={banner.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-end bg-primary-600 p-3 text-sm font-bold text-white">
                {isAr ? banner.titleAr : banner.titleEn}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
