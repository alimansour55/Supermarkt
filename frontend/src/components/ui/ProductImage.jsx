import { useState } from 'react';
import { isImageUrl } from '../../utils/imageHelpers';

function PlaceholderIcon({ className = 'h-10 w-10' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="10" y="18" width="44" height="34" rx="7" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M22 24c0-7 4-12 10-12s10 5 10 12" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 30h28" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 39h19" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 45h13" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="46" cy="42" r="5" fill="#e2e8f0" />
    </svg>
  );
}

export default function ProductImage({
  src,
  alt = '',
  className = '',
  imgClassName = 'h-full w-full object-contain p-2',
  placeholderClassName = '',
  sizes,
}) {
  const [failed, setFailed] = useState(false);
  const validSrc = src && isImageUrl(src) && !failed ? src : null;
  const hasBgOverride = /\bbg-/.test(className) || /\bfrom-/.test(className) || /\bto-/.test(className) || /\bbg-gradient/.test(className);

  return (
    <div
      className={[
        'flex items-center justify-center',
        hasBgOverride ? '' : 'bg-gradient-to-br from-slate-50 to-white',
        className,
      ].join(' ')}
    >
      {validSrc ? (
        <img
          src={validSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          onError={() => setFailed(true)}
          className={imgClassName}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center border border-dashed border-slate-200 text-slate-300 ${placeholderClassName}`}>
          <PlaceholderIcon className="h-14 w-14 sm:h-16 sm:w-16" />
        </div>
      )}
    </div>
  );
}
