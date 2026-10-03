import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getHeaderToolbarByZone } from '../../utils/headerToolbarConfig';
import CategoriesDropdown from './CategoriesDropdown';
import AccountMenu from './AccountMenu';
import ToolbarIcon, { TOOLBAR_PILL_CLASS, TOOLBAR_PLAIN_CLASS } from './ToolbarIcon';

function labelClassName(showLabel, pill) {
  if (!showLabel) return 'sr-only';
  return pill ? 'hidden sm:inline' : 'hidden lg:inline';
}

function FavoritesAction({ item, isAr }) {
  const { favoriteCount } = useFavorites();
  const label = isAr ? (item.labelAr || 'المفضلة') : (item.labelEn || 'Favorites');

  return (
    <Link to="/favorites" className={TOOLBAR_PLAIN_CLASS} aria-label={label}>
      <ToolbarIcon icon="heart" itemKey="favorites" />
      <span className={labelClassName(item.showLabel, false)}>{label}</span>
      {favoriteCount > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {favoriteCount > 99 ? '99+' : favoriteCount}
        </span>
      )}
    </Link>
  );
}

function CartAction({ item, isAr }) {
  const { totalItems } = useCart();
  const label = isAr ? (item.labelAr || 'السلة') : (item.labelEn || 'Cart');

  return (
    <Link to="/cart" className={TOOLBAR_PLAIN_CLASS} aria-label={label}>
      <ToolbarIcon icon="shopping-cart" itemKey="cart" />
      <span className={labelClassName(item.showLabel, false)}>{label}</span>
      {totalItems > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  );
}

function CustomLinkAction({ item, isAr }) {
  const label = isAr ? (item.labelAr || item.labelEn || 'Link') : (item.labelEn || item.labelAr || 'Link');
  const pill = item.variant === 'pill';
  const className = pill ? TOOLBAR_PILL_CLASS : TOOLBAR_PLAIN_CLASS;
  const content = (
    <>
      <ToolbarIcon icon={item.icon} itemKey="link" />
      <span className={labelClassName(item.showLabel, pill)}>{label}</span>
    </>
  );

  if (item.isExternal) {
    return (
      <a href={item.href} className={className} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link to={item.href || '/'} className={className}>
      {content}
    </Link>
  );
}

function ToolbarItem({ item }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (item.itemKey === 'categories') {
    return <CategoriesDropdown showLabel={item.showLabel !== false} />;
  }
  if (item.itemKey === 'favorites') {
    return <FavoritesAction item={item} isAr={isAr} />;
  }
  if (item.itemKey === 'account') {
    return <AccountMenu showLabel={item.showLabel !== false} />;
  }
  if (item.itemKey === 'cart') {
    return <CartAction item={item} isAr={isAr} />;
  }
  return <CustomLinkAction item={item} isAr={isAr} />;
}

export default function HeaderToolbar({ zone = 'start' }) {
  const { settings } = useStoreSettings();
  const groups = getHeaderToolbarByZone(settings?.navigation);
  const items = zone === 'start' ? groups.start : groups.end;

  if (!items.length) return null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {items.map((item, index) => (
        <ToolbarItem key={`${item.itemKey}-${item.href || ''}-${index}`} item={item} />
      ))}
    </div>
  );
}
