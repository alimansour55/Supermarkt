import {
  BadgePercent,
  Bookmark,
  Boxes,
  Flame,
  Gift,
  Grid2x2,
  Heart,
  Home,
  Layers,
  LayoutGrid,
  Link2,
  List,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  User,
} from 'lucide-react';
import { normalizeToolbarIconKey } from '../../utils/headerToolbarIcons';

export const ICON_MAP = {
  'layout-grid': LayoutGrid,
  'grid-2x2': Grid2x2,
  layers: Layers,
  list: List,
  package: Package,
  boxes: Boxes,
  'shopping-bag': ShoppingBag,
  store: Store,
  tag: Tag,
  'badge-percent': BadgePercent,
  sparkles: Sparkles,
  flame: Flame,
  star: Star,
  heart: Heart,
  'shopping-cart': ShoppingCart,
  gift: Gift,
  truck: Truck,
  user: User,
  home: Home,
  search: Search,
  'map-pin': MapPin,
  phone: Phone,
  mail: Mail,
  bookmark: Bookmark,
  link: Link2,
  categories: LayoutGrid,
  favorites: Heart,
  account: User,
  cart: ShoppingCart,
};

export const TOOLBAR_PILL_CLASS = [
  'flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5',
  'text-sm font-semibold text-text transition-colors',
  'hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700',
].join(' ');

export const TOOLBAR_PLAIN_CLASS = [
  'relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-text',
  'transition-colors hover:bg-surface',
].join(' ');

export function getToolbarIconComponent(icon, itemKey) {
  const key = normalizeToolbarIconKey(icon, itemKey);
  return ICON_MAP[key] || LayoutGrid;
}

export default function ToolbarIcon({ icon, itemKey, className = 'h-5 w-5 shrink-0' }) {
  const Icon = getToolbarIconComponent(icon, itemKey);
  return <Icon className={className} aria-hidden />;
}
