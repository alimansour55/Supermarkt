import { useState } from 'react';
import { isImageUrl } from '../../utils/imageHelpers';

const SIZE_CLASS = {
  xs: { box: 'h-8 w-8', text: 'text-base', img: 'rounded-lg' },
  sm: { box: 'h-12 w-12', text: 'text-2xl', img: 'rounded-xl' },
  md: { box: 'h-16 w-16', text: 'text-3xl', img: 'rounded-2xl' },
  lg: { box: 'h-20 w-20 md:h-24 md:w-24', text: 'text-4xl', img: 'rounded-2xl' },
};

/**
 * Shows category photo from admin when set; falls back to emoji icon.
 */
export default function CategoryImage({
  category,
  image,
  icon = '🛒',
  color = 'bg-primary-50',
  alt = '',
  size = 'md',
  className = '',
  imgClassName = 'h-full w-full object-cover',
}) {
  const [failed, setFailed] = useState(false);
  const src = image || category?.image;
  const displayIcon = category?.icon || icon;
  const displayColor = category?.color || color;
  const sizes = SIZE_CLASS[size] || SIZE_CLASS.md;
  const validSrc = src && isImageUrl(src) && !failed ? src : null;

  if (validSrc) {
    return (
      <span className={`relative shrink-0 overflow-hidden ${sizes.box} ${sizes.img} ${className}`}>
        <img
          src={validSrc}
          alt={alt}
          className={imgClassName}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${sizes.box} ${sizes.img} ${displayColor} ${className}`}
      aria-hidden={!alt}
    >
      <span className={sizes.text}>{displayIcon}</span>
    </span>
  );
}
