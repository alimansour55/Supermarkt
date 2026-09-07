import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  FolderOpen,
  Headphones,
  Home,
  LayoutGrid,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useCategories } from '../../context/CategoriesContext';
import CategoryImage from '../category/CategoryImage';
import ProductImage from '../ui/ProductImage';
import DeliveryWeekPicker from '../checkout/DeliveryWeekPicker';
import RecurringSchedulePicker from '../checkout/RecurringSchedulePicker';
import { RECURRING_FREQUENCIES, computeFirstRecurringDeliveryDate } from '../../constants/deliveryOptions';
import { filterAvailableSlots, resolveSelectedSlot } from '../../utils/deliverySlotAvailability';
import { formatLeadMinutesLabel } from '../../utils/deliveryLeadTime';
import {
  buildAssistantUnavailableReply,
  CHECKOUT_PANEL_LAYOUTS,
  createInitialChatState,
  FLOWS,
  getWelcomeMessages,
  mapAssistantReply,
  mergeCheckoutChatMessages,
  processChatInput,
  resolveLocalChatAction,
} from '../../utils/supportChatEngine';
import { fetchAssistantStatus, sendAssistantMessage } from '../../services/assistantApi';
import { initApiConnection } from '../../utils/initApiConnection';
import { useSupportChat } from '../../context/SupportChatContext';
import { useLocation as useDeliveryLocation } from '../../context/LocationContext';
import { placeAssistantOrder } from '../../utils/placeAssistantOrder';
import { paymentService, authService } from '../../services/apiServices';
import { formatOrderNumber } from '../../utils/orderNumber';
import { formatPrice } from '../../utils/formatters';
import { calculatePromotedLineTotal } from '../../utils/cartLinePricing';
import AssistantMark from './AssistantMark';

const HIDDEN_PREFIXES = [
  '/admin', '/payment', '/login', '/register',
  '/verify-email', '/forgot-password', '/reset-password', '/driver',
];

const MOBILE_CHAT_MQ = '(max-width: 767px)';

const CHECKOUT_INTERRUPT_ACTIONS = new Set([
  'browse_shop',
  'orders',
  'cart',
  'delivery',
  'contact',
  'checkout_ai',
  'begin_checkout',
  'menu',
  'start_over',
  'open_cart',
]);

function isMobileChatViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_CHAT_MQ).matches;
}

function preventMobileChatInputScroll(event) {
  if (!isMobileChatViewport()) return;
  event.target.focus({ preventScroll: true });
}

function scrollMobileChatFieldIntoView(event) {
  if (!isMobileChatViewport()) return;
  event.target.focus({ preventScroll: true });
  const field = event.currentTarget;
  const list = field.closest('[data-support-chat-scroll]');
  if (!list) return;
  requestAnimationFrame(() => {
    const listRect = list.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    list.scrollTop += fieldRect.top - listRect.top - 20;
  });
}

const ICONS = {
  search: Search,
  orders: Package,
  cart: ShoppingCart,
  delivery: Truck,
  contact: Headphones,
  goodbye: Sparkles,
  menu: Home,
  back: null,
  login: Bot,
  checkout: ShoppingBag,
  browse: LayoutGrid,
  track: Truck,
  edit: Tag,
  cancel: X,
  price: Tag,
  whatsapp: Headphones,
};

function BotAvatar({ size = 'md', className = '' }) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-[1.125rem] w-[1.125rem]';
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm ring-2 ring-white ${dim} ${className}`}>
      <AssistantMark className={icon} />
    </div>
  );
}

function ActionIcon({ name, isAr }) {
  if (name === 'back') {
    const Icon = isAr ? ArrowRight : ArrowLeft;
    return <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />;
  }
  const Icon = ICONS[name] || Sparkles;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />;
}

function QuickMenuBar({ isAr, onAction, disabled }) {
  const items = [
    { id: 'browse_shop', label: isAr ? 'تسوق الآن' : 'Shop now', icon: 'browse' },
    { id: 'orders', label: isAr ? 'طلباتي' : 'My orders', icon: 'orders' },
    { id: 'cart', label: isAr ? 'السلة' : 'Cart', icon: 'cart' },
    { id: 'delivery', label: isAr ? 'التوصيل' : 'Delivery', icon: 'delivery' },
    { id: 'contact', label: isAr ? 'تواصل معنا' : 'Contact us', icon: 'contact' },
  ];

  return (
    <div
      className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-slate-100 bg-slate-50/90 px-2.5 py-2 scrollbar-thin"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(item.id, { id: item.id, icon: item.icon })}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 disabled:opacity-40"
        >
          <ActionIcon name={item.icon} isAr={isAr} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ChatFooterBar({ isAr, onAction, disabled, canGoBack }) {
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  return (
    <div
      className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-3 py-2.5"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        disabled={disabled || !canGoBack}
        onClick={() => onAction('back', { id: 'back' })}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <BackIcon className="h-3.5 w-3.5" />
        {isAr ? 'الرجوع' : 'Back'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction('change_selection', { id: 'change_selection' })}
        className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
      >
        {isAr ? 'تغيير الاختيار' : 'Change'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction('start_over', { id: 'start_over' })}
        className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-bold text-amber-950 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-40"
      >
        {isAr ? 'البدء من جديد' : 'Start over'}
      </button>
    </div>
  );
}

const SHOP_PANEL_LAYOUTS = new Set(['shop_collections', 'category_browse', 'products', 'cart', 'checkout_addresses', 'checkout_delivery', 'checkout_delivery_schedule', 'checkout_payment', 'checkout_confirm', 'address_form']);

function ChatCartCheckoutBar({ isAr, itemCount, subtotal, onCheckout, onViewCart, disabled }) {
  if (!itemCount) return null;
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-t border-primary-200/80 bg-gradient-to-r from-primary-50 to-white px-3 py-2.5"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onViewCart}
        className="min-w-0 flex-1 text-start disabled:opacity-50"
      >
        <p className="text-[10px] font-semibold text-primary-800/70">
          {isAr ? 'السلة' : 'Cart'}
        </p>
        <p className="truncate text-xs font-bold text-primary-900">
          {itemCount} {isAr ? (itemCount === 1 ? 'منتج' : 'منتجات') : (itemCount === 1 ? 'item' : 'items')}
          {' · '}
          {formatPrice(subtotal)}
        </p>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCheckout}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        {isAr ? 'إتمام الشراء' : 'Checkout'}
      </button>
    </div>
  );
}

function ChatAddedToCartNotice({ isAr, productName, onViewCart, onDismiss }) {
  if (!productName) return null;
  return (
    <div
      className="support-chat-cart-notice shrink-0 border-t border-emerald-200/90 bg-emerald-50 px-3 py-2"
      dir={isAr ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-emerald-950">
          <span className="font-bold">{isAr ? 'تمت الإضافة للسلة' : 'Added to cart'}</span>
          <span className="font-medium text-emerald-800/90"> · {productName}</span>
        </p>
        <button
          type="button"
          onClick={onViewCart}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {isAr ? 'عرض السلة' : 'View cart'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-700/70 transition hover:bg-emerald-100 hover:text-emerald-900"
          aria-label={isAr ? 'إغلاق' : 'Dismiss'}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ChatSectionHeader({ title, subtitle }) {
  if (!title && !subtitle) return null;
  return (
    <div className="mb-3 border-b border-slate-100 pb-3">
      {title && (
        <p className="text-sm font-semibold text-text">{title}</p>
      )}
      {subtitle && (
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{subtitle}</p>
      )}
    </div>
  );
}

function BrowseBreadcrumb({ segments, isAr, onAction }) {
  if (!segments?.length) return null;
  const Chevron = isAr ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1 text-[10px] text-text-muted">
      {segments.map((seg, i) => (
        <span key={seg.path || seg.label} className="inline-flex items-center gap-1">
          {i > 0 && <Chevron className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
          {seg.path && i < segments.length - 1 ? (
            <button
              type="button"
              onClick={() => onAction(`browse_pick:${encodeURIComponent(seg.path)}`, { id: `browse_pick:${seg.path}` })}
              className="font-medium text-primary-600 hover:underline"
            >
              {seg.label}
            </button>
          ) : (
            <span className={i === segments.length - 1 ? 'font-semibold text-text' : ''}>{seg.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

const COLLECTION_ICONS = {
  deals: Flame,
  best_sellers: Star,
  new_arrivals: Zap,
  categories: FolderOpen,
};

const COLLECTION_STYLES = {
  deals: 'bg-orange-50 text-orange-600 ring-orange-100/80',
  best_sellers: 'bg-amber-50 text-amber-600 ring-amber-100/80',
  new_arrivals: 'bg-sky-50 text-sky-600 ring-sky-100/80',
  categories: 'bg-primary-50 text-primary-600 ring-primary-100/80',
};

function ShopCollectionsBody({ message, isAr, onAction }) {
  const collections = message.shopCollections || [];
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="mt-1 space-y-2">
      <button
        type="button"
        onClick={() => onAction('search', { id: 'search' })}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-primary-200 bg-primary-50/60 px-3 py-2.5 text-start transition hover:border-primary-300 hover:bg-primary-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm ring-1 ring-primary-100">
          <Search className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-primary-900">
            {isAr ? 'ابحث بالاسم' : 'Search by name'}
          </span>
          <span className="mt-0.5 block text-[10px] text-primary-700/80">
            {isAr ? 'مثال: حليب، منظف، خبز…' : 'e.g. milk, detergent, bread…'}
          </span>
        </span>
        <Chevron className="h-4 w-4 shrink-0 text-primary-400" />
      </button>

      <p className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {isAr ? 'أو اختر من المقترحات' : 'Or pick a collection'}
      </p>

      <div className="space-y-1.5">
        {collections.map((col) => {
          const Icon = COLLECTION_ICONS[col.id] || LayoutGrid;
          const iconStyle = COLLECTION_STYLES[col.id] || COLLECTION_STYLES.categories;
          const actionId = col.actionId === 'browse_categories'
            ? 'browse_categories'
            : `collection_pick:${col.id}`;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => onAction(actionId, { id: actionId })}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-start shadow-sm transition hover:border-primary-200 hover:bg-slate-50/80 active:scale-[0.99]"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${iconStyle}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">{col.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">{col.desc}</span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryBrowseBody({ message, isAr, onAction }) {
  const categories = message.browseCategories || [];
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="mt-1">
      <BrowseBreadcrumb segments={message.browseBreadcrumb} isAr={isAr} onAction={onAction} />

      {categories.length > 0 ? (
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <button
              key={cat.slugPath || cat.slug}
              type="button"
              onClick={() => onAction(`browse_pick:${encodeURIComponent(cat.slugPath)}`, { id: `browse_pick:${cat.slugPath}` })}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-start shadow-sm transition hover:border-primary-200 hover:bg-slate-50/80 active:scale-[0.99]"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100"
                style={cat.color ? { backgroundColor: `${cat.color}12` } : undefined}
              >
                {cat.image ? (
                  <CategoryImage category={cat} size="xs" className="!h-9 !w-9 rounded-lg" />
                ) : (
                  <span className="text-lg leading-none">{cat.icon || '🛒'}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{cat.name}</span>
                <span className="mt-0.5 block text-[11px] text-text-muted">{cat.subtitle}</span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-text-muted">
          {isAr ? 'لا توجد أقسام هنا' : 'No categories here'}
        </p>
      )}

      {message.actions?.length > 0 && (
        <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
      )}
    </div>
  );
}

function ActionGrid({ actions, isAr, onAction, variant = 'default' }) {
  if (!actions?.length) return null;
  const isMenu = variant === 'menu' || (variant !== 'compact' && actions.length >= 4 && actions.every((a) => !a.href));

  if (variant === 'compact') {
    return (
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id, action)}
            className={[
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
              action.variant === 'primary'
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'text-primary-700 hover:bg-primary-50',
            ].join(' ')}
          >
            <ActionIcon name={action.icon} isAr={isAr} />
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  if (isMenu) {
    const primary = actions.find((a) => a.variant === 'primary') || actions.find((a) => a.id === 'search');
    const secondary = actions.filter((a) => a !== primary);

    return (
      <div className="mt-3 space-y-2.5">
        {primary && (
          <button
            type="button"
            onClick={() => onAction(primary.id, primary)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition hover:from-primary-600 hover:to-primary-800 active:scale-[0.98]"
          >
            <ActionIcon name={primary.icon} isAr={isAr} />
            {primary.label}
          </button>
        )}
        {secondary.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {secondary.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id, action)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-start text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-900 active:scale-[0.98]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-primary-600">
                  <ActionIcon name={action.icon} isAr={isAr} />
                </span>
                <span className="leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction(action.id, action)}
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]',
            action.variant === 'primary'
              ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
              : 'border border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-primary-50',
          ].join(' ')}
        >
          <ActionIcon name={action.icon} isAr={isAr} />
          {action.label}
        </button>
      ))}
    </div>
  );
}

function WelcomeBody({ message, isAr, onAction }) {
  return <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="menu" />;
}

function findCartItemForProduct(cartItems, productId) {
  if (!cartItems?.length || !productId) return null;
  const id = String(productId);
  return cartItems.find(
    (item) => String(item.productId) === id || String(item.cartKey) === id,
  ) || null;
}

function ProductResults({ products, isAr, onAction, headerHref, headerLabel, cartItems, onUpdateQuantity }) {
  if (!products?.length) return null;
  return (
    <div className="mt-1 space-y-2">
      {headerHref && headerLabel && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-muted">
            {isAr ? `${products.length} منتج` : `${products.length} item(s)`}
          </span>
          <button
            type="button"
            onClick={() => onAction('go_collection', { id: 'go_collection', href: headerHref })}
            className="text-[11px] font-semibold text-primary-600 hover:underline"
          >
            {headerLabel}
          </button>
        </div>
      )}
      {products.map((product) => {
        const cartItem = findCartItemForProduct(cartItems, product.id);
        const cartKey = cartItem?.cartKey || cartItem?.productId || product.id;
        const atMax = cartItem?.availableStock != null && cartItem.quantity >= cartItem.availableStock;

        return (
          <div
            key={product.id}
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-primary-200/60"
          >
            <div className="flex gap-3 p-3">
              <ProductImage
                src={product.image}
                alt={product.name}
                emoji={product.emoji}
                className="h-16 w-16 shrink-0 rounded-xl ring-1 ring-slate-100"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-text">{product.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-primary-700">{product.price}</span>
                  {product.oldPrice && (
                    <span className="text-xs text-text-muted line-through">{product.oldPrice}</span>
                  )}
                </div>
                <span
                  className={[
                    'mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold',
                    product.stock?.tone === 'out' && 'bg-red-50 text-red-700',
                    product.stock?.tone === 'low' && 'bg-amber-50 text-amber-800',
                    product.stock?.tone === 'ok' && 'bg-emerald-50 text-emerald-700',
                  ].filter(Boolean).join(' ')}
                >
                  {product.stock?.label}
                </span>
              </div>
            </div>
            {(product.canAdd || cartItem) && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                {cartItem ? (
                  <div className="flex items-center justify-center">
                    <div className="flex w-full max-w-[10rem] items-center rounded-lg border border-primary-200 bg-white p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(cartKey, cartItem.quantity - 1)}
                        className="flex h-8 flex-1 items-center justify-center rounded-md text-primary-700 transition hover:bg-primary-50"
                        aria-label={isAr ? 'تقليل' : 'Decrease'}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-primary-800">
                        {cartItem.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(cartKey, cartItem.quantity + 1)}
                        disabled={atMax}
                        className="flex h-8 flex-1 items-center justify-center rounded-md text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={isAr ? 'زيادة' : 'Increase'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction(`add:${product.id}`, { id: `add:${product.id}` })}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2 text-xs font-bold text-white transition hover:bg-primary-700"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {isAr ? 'أضف للسلة' : 'Add to cart'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckoutAddressForm({ message, isAr, onSave, saving, compactMobile = false, onBack }) {
  const defaults = message.addressDefaults || {};
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [area, setArea] = useState(defaults.area || '');
  const [city, setCity] = useState(defaults.city || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!street.trim()) return;
    onSave({
      label: 'Home',
      street: street.trim(),
      building: building.trim(),
      area: area.trim() || city.trim(),
      city: city.trim() || defaults.city || '',
      governorate: defaults.governorate || city.trim() || '',
      isDefault: true,
      deliveryZoneId: defaults.deliveryZoneId,
    });
  };

  const inputClass = compactMobile
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100'
    : 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  return (
    <form
      id={compactMobile ? 'support-chat-address-form' : undefined}
      data-support-chat-address-form
      onSubmit={handleSubmit}
      className={`mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 ${compactMobile ? 'support-chat-address-form-mobile' : ''}`}
    >
      {compactMobile && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"
        >
          {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {isAr ? 'رجوع' : 'Back'}
        </button>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-muted">
          {isAr ? 'الشارع / العنوان' : 'Street address'} *
        </label>
        <input
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          onFocus={scrollMobileChatFieldIntoView}
          placeholder={isAr ? 'مثال: شارع التحرير، المعادي' : 'e.g. 12 Nile Street'}
          className={inputClass}
          autoComplete="street-address"
          required
        />
      </div>
      <div className={compactMobile ? 'space-y-3' : 'grid grid-cols-2 gap-2'}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text-muted">
            {isAr ? 'مبنى' : 'Building'}
          </label>
          <input
            type="text"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            onFocus={scrollMobileChatFieldIntoView}
            className={inputClass.replace('focus:ring-2 focus:ring-primary-100', 'focus:outline-none')}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text-muted">
            {isAr ? 'المنطقة' : 'Area'}
          </label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            onFocus={scrollMobileChatFieldIntoView}
            className={inputClass.replace('focus:ring-2 focus:ring-primary-100', 'focus:outline-none')}
            autoComplete="address-level2"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-muted">
          {isAr ? 'المدينة' : 'City'}
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onFocus={scrollMobileChatFieldIntoView}
          className={inputClass.replace('focus:ring-2 focus:ring-primary-100', 'focus:outline-none')}
          autoComplete="address-level1"
        />
      </div>
      {!compactMobile && (
        <button
          type="submit"
          disabled={saving || !street.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          <MapPin className="h-4 w-4" />
          {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ ومتابعة الطلب' : 'Save & continue')}
        </button>
      )}
    </form>
  );
}

function CheckoutStepIndicator({ step, total, label, isAr }) {
  return (
    <div className="mb-3 rounded-xl border border-primary-100 bg-primary-50/70 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary-700">
        {isAr ? `الخطوة ${step} من ${total}` : `Step ${step} of ${total}`}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-primary-900">{label}</p>
    </div>
  );
}

function CheckoutAddressesBody({ message, isAr, onAction, disabled = false }) {
  const addresses = message.savedAddresses || [];
  const step = message.checkoutStep || 1;
  const total = message.checkoutStepsTotal || 5;

  return (
    <div className="mt-1 space-y-3">
      <CheckoutStepIndicator
        step={step}
        total={total}
        label={isAr ? 'اختر عنوان التوصيل' : 'Choose delivery address'}
        isAr={isAr}
      />

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950 ring-1 ring-amber-100">
        {isAr
          ? '👇 اضغط «تأكيد العنوان» على العنوان الصحيح للمتابعة إلى اختيار طريقة التوصيل.'
          : '👇 Tap «Confirm address» on the correct address to continue to delivery options.'}
      </p>

      {message.cartSubtotal && (
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold text-text-muted">{isAr ? 'إجمالي السلة' : 'Cart total'}</p>
          <p className="text-base font-bold text-primary-700">{message.cartSubtotal}</p>
        </div>
      )}

      <div className="space-y-2.5">
        {addresses.map((addr) => (
          <article
            key={addr.id}
            className={[
              'overflow-hidden rounded-xl border shadow-sm',
              addr.isDefault ? 'border-primary-300 bg-primary-50/30' : 'border-slate-200 bg-white',
            ].join(' ')}
          >
            <div className="flex items-start gap-2.5 p-3 pb-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-100">
                <MapPin className="h-4 w-4 text-primary-600" />
              </span>
              <span className="min-w-0 flex-1">
                {addr.label && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary-700">{addr.label}</span>
                )}
                <p className="text-sm font-semibold leading-snug text-text">{addr.line}</p>
                {addr.isDefault && (
                  <span className="mt-1 inline-flex rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-800">
                    {isAr ? 'الافتراضي' : 'Default'}
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction(`checkout_addr:${addr.id}`, { id: `checkout_addr:${addr.id}` })}
              className={[
                'flex w-full items-center justify-center gap-2 border-t px-3 py-2.5 text-xs font-bold transition',
                addr.isDefault
                  ? 'border-primary-200 bg-primary-600 text-white hover:bg-primary-700'
                  : 'border-slate-100 bg-slate-50 text-primary-800 hover:bg-primary-50',
              ].join(' ')}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isAr ? 'تأكيد العنوان والمتابعة' : 'Confirm address & continue'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function CheckoutDeliveryBody({ message, isAr, onAction, disabled: actionsDisabled = false }) {
  const methods = message.deliveryMethods || [];
  const step = message.checkoutStep || 2;
  const total = message.checkoutStepsTotal || 5;

  return (
    <div className="mt-1 space-y-3">
      <CheckoutStepIndicator
        step={step}
        total={total}
        label={isAr ? 'اختر طريقة التوصيل' : 'Choose delivery method'}
        isAr={isAr}
      />
      {message.deliveryLine && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted ring-1 ring-slate-100">
          <span className="font-semibold text-text">{isAr ? 'التوصيل إلى: ' : 'Deliver to: '}</span>
          {message.deliveryLine}
        </p>
      )}
      {message.cartSubtotal && (
        <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold text-text-muted">{isAr ? 'إجمالي المنتجات' : 'Items subtotal'}</p>
          <p className="text-sm font-bold text-primary-700">{message.cartSubtotal}</p>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-text-muted">
        {isAr ? 'اختر سرعة التوصيل — ثم حدّد الموعد يدوياً في الخطوة التالية.' : 'Pick delivery speed — then choose your date and time in the next step.'}
      </p>
      <div className="space-y-2">
        {methods.map((method) => {
          const isExpress = method.id === 'express';
          const isRecurring = method.id === 'recurring';
          const Icon = isExpress ? Zap : (isRecurring ? RefreshCw : Truck);
          const unavailable = method.available === false;
          return (
            <button
              key={method.id}
              type="button"
              disabled={actionsDisabled || unavailable}
              onClick={() => onAction(`checkout_deliver:${method.id}`, { id: `checkout_deliver:${method.id}` })}
              className={[
                'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-start transition active:scale-[0.99]',
                actionsDisabled || unavailable
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                  : isExpress
                    ? 'border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-50'
                    : isRecurring
                      ? 'border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-50'
                      : 'border-primary-200 bg-primary-50/50 hover:border-primary-300 hover:bg-primary-50',
              ].join(' ')}
            >
              <span className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                isExpress
                  ? 'bg-amber-100 text-amber-600'
                  : isRecurring
                    ? 'bg-violet-100 text-violet-600'
                    : 'bg-primary-100 text-primary-700',
              ].join(' ')}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-text">{method.label}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-primary-800 ring-1 ring-primary-100">
                    {method.feeLabel}
                  </span>
                </span>
                {method.description && (
                  <span className="mt-0.5 block text-[11px] text-text-muted">{method.description}</span>
                )}
                {method.slotHint && (
                  <span className="mt-1 block text-[10px] font-medium text-primary-800/80">{method.slotHint}</span>
                )}
                {method.unavailableNote && (
                  <span className="mt-1 block text-[10px] font-semibold text-amber-800">{method.unavailableNote}</span>
                )}
              </span>
              <ChevronLeft className={`mt-1 h-4 w-4 shrink-0 opacity-60 ${isAr ? '' : 'rotate-180'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckoutDeliveryScheduleBody({
  message,
  isAr,
  language,
  location,
  onConfirmSchedule,
  disabled: actionsDisabled = false,
}) {
  const defaults = message.scheduleDefaults || {};
  const deliveryMethod = message.deliveryMethod || defaults.deliveryMethod || 'scheduled';
  const timeSlots = location?.timeSlots || [];
  const scheduledLeadMinutes = message.scheduledLeadMinutes || 120;
  const step = message.checkoutStep || 3;
  const total = message.checkoutStepsTotal || 5;

  const [form, setForm] = useState({
    scheduledDate: defaults.scheduledDate || '',
    scheduledTime: defaults.scheduledTime ? String(defaults.scheduledTime) : '',
    recurringFrequency: defaults.recurringFrequency || 'weekly',
    recurringPreferredWeekday: defaults.recurringPreferredWeekday ?? new Date().getDay(),
    recurringPreferredDayOfMonth: defaults.recurringPreferredDayOfMonth || new Date().getDate(),
  });

  const availableSlotsForDate = useMemo(
    () => filterAvailableSlots(timeSlots, form.scheduledDate, new Date(), scheduledLeadMinutes),
    [timeSlots, form.scheduledDate, scheduledLeadMinutes],
  );

  const selectedSlot = useMemo(
    () => resolveSelectedSlot(timeSlots, form.scheduledTime, form.scheduledDate, new Date(), scheduledLeadMinutes),
    [timeSlots, form.scheduledTime, form.scheduledDate, scheduledLeadMinutes],
  );

  useEffect(() => {
    if (form.scheduledDate || !defaults.scheduledDate) return;
    setForm((prev) => ({
      ...prev,
      scheduledDate: defaults.scheduledDate,
      scheduledTime: defaults.scheduledTime ? String(defaults.scheduledTime) : prev.scheduledTime,
    }));
  }, [defaults.scheduledDate, defaults.scheduledTime, form.scheduledDate]);

  useEffect(() => {
    if (!form.scheduledDate || !availableSlotsForDate.length) return;
    const valid = availableSlotsForDate.some((slot) => String(slot._id) === String(form.scheduledTime));
    if (!valid) {
      setForm((prev) => ({ ...prev, scheduledTime: String(availableSlotsForDate[0]._id) }));
    }
  }, [form.scheduledDate, form.scheduledTime, availableSlotsForDate]);

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleConfirm = () => {
    onConfirmSchedule({
      deliveryMethod,
      addressId: defaults.addressId,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      recurringFrequency: form.recurringFrequency,
      recurringPreferredWeekday: form.recurringPreferredWeekday,
      recurringPreferredDayOfMonth: form.recurringPreferredDayOfMonth,
    });
  };

  return (
    <div className="mt-1 space-y-3">
      <CheckoutStepIndicator
        step={step}
        total={total}
        label={deliveryMethod === 'recurring'
          ? (isAr ? 'جدول التوصيل الدوري' : 'Recurring schedule')
          : (isAr ? 'اختر يوم وموعد التوصيل' : 'Choose day & time')}
        isAr={isAr}
      />
      {message.deliveryLine && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted ring-1 ring-slate-100">
          <span className="font-semibold text-text">{isAr ? 'التوصيل إلى: ' : 'Deliver to: '}</span>
          {message.deliveryLine}
        </p>
      )}
      {message.deliveryMethodLine && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-900 ring-1 ring-primary-100">
          {isAr ? 'الطريقة: ' : 'Method: '}{message.deliveryMethodLine}
        </p>
      )}

      {deliveryMethod === 'scheduled' && (
        <DeliveryWeekPicker
          value={form.scheduledDate}
          onChange={(scheduledDate) => patchForm({ scheduledDate })}
          language={language}
          timeSlots={timeSlots}
          minLeadMinutes={scheduledLeadMinutes}
        />
      )}

      {deliveryMethod === 'recurring' && (
        <>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text">
              <CalendarClock className="h-4 w-4 text-violet-600" />
              {isAr ? 'تكرار التوصيل' : 'Delivery frequency'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {RECURRING_FREQUENCIES.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => patchForm({
                    recurringFrequency: freq.value,
                    scheduledDate: computeFirstRecurringDeliveryDate({
                      frequency: freq.value,
                      preferredWeekday: form.recurringPreferredWeekday,
                      preferredDayOfMonth: form.recurringPreferredDayOfMonth,
                      slotFrom: selectedSlot?.from,
                    }, new Date(), timeSlots, scheduledLeadMinutes),
                  })}
                  className={[
                    'rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition',
                    form.recurringFrequency === freq.value
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 bg-white text-text hover:border-violet-300',
                  ].join(' ')}
                >
                  {isAr ? freq.labelAr : freq.labelEn}
                </button>
              ))}
            </div>
          </div>
          <RecurringSchedulePicker
            frequency={form.recurringFrequency}
            preferredWeekday={form.recurringPreferredWeekday}
            preferredDayOfMonth={form.recurringPreferredDayOfMonth}
            timeSlotLabelAr={selectedSlot?.labelAr}
            timeSlotLabelEn={selectedSlot?.labelEn}
            timeSlots={timeSlots}
            slotFrom={selectedSlot?.from}
            minLeadMinutes={scheduledLeadMinutes}
            onChange={patchForm}
            language={language}
          />
        </>
      )}

      {deliveryMethod !== 'express' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text">
            {isAr ? 'موعد التوصيل' : 'Time slot'}
          </label>
          <p className="mb-2 text-[11px] text-text-muted">
            {isAr
              ? `المواعيد المتاحة تبدأ بعد ${formatLeadMinutesLabel(scheduledLeadMinutes, 'ar')} على الأقل من الآن`
              : `Available slots start at least ${formatLeadMinutesLabel(scheduledLeadMinutes, 'en')} from now`}
          </p>
          <select
            value={form.scheduledTime}
            onChange={(e) => patchForm({ scheduledTime: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            disabled={!availableSlotsForDate.length}
          >
            {!availableSlotsForDate.length ? (
              <option value="">
                {isAr ? 'لا توجد مواعيد متاحة لهذا اليوم' : 'No slots available for this day'}
              </option>
            ) : (
              availableSlotsForDate.map((slot) => (
                <option key={slot._id} value={slot._id}>
                  {isAr ? slot.labelAr : slot.labelEn}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={actionsDisabled || !form.scheduledDate || !form.scheduledTime}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition hover:from-primary-600 hover:to-primary-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-5 w-5" />
        {isAr ? 'تأكيد الموعد والمتابعة' : 'Confirm time & continue'}
      </button>
    </div>
  );
}

function CheckoutPaymentBody({ message, isAr, onAction, disabled: actionsDisabled = false }) {
  const methods = message.paymentMethods || [];
  const step = message.checkoutStep || 4;
  const total = message.checkoutStepsTotal || 5;

  return (
    <div className="mt-1 space-y-3">
      <CheckoutStepIndicator
        step={step}
        total={total}
        label={isAr ? 'اختر طريقة الدفع' : 'Choose payment method'}
        isAr={isAr}
      />
      {message.deliveryLine && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted ring-1 ring-slate-100">
          <span className="font-semibold text-text">{isAr ? 'التوصيل إلى: ' : 'Deliver to: '}</span>
          {message.deliveryLine}
        </p>
      )}
      {(message.deliveryMethodLine || message.orderTotalLine) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {message.deliveryMethodLine && (
            <span className="rounded-lg bg-primary-50 px-2 py-1 font-semibold text-primary-900 ring-1 ring-primary-100">
              {isAr ? 'التوصيل: ' : 'Delivery: '}{message.deliveryMethodLine}
            </span>
          )}
          {message.scheduleLine && (
            <span className="rounded-lg bg-sky-50 px-2 py-1 font-semibold text-sky-900 ring-1 ring-sky-100">
              {isAr ? 'الموعد: ' : 'Time: '}{message.scheduleLine}
            </span>
          )}
          {message.deliveryFeeLine && (
            <span className="rounded-lg bg-slate-50 px-2 py-1 font-semibold text-text ring-1 ring-slate-100">
              {isAr ? 'رسوم: ' : 'Fee: '}{message.deliveryFeeLine}
            </span>
          )}
          {message.orderTotalLine && (
            <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-900 ring-1 ring-emerald-100">
              {isAr ? 'الإجمالي: ' : 'Total: '}{message.orderTotalLine}
            </span>
          )}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-text-muted">
        {isAr ? 'اختر طريقة الدفع للمتابعة إلى التأكيد النهائي.' : 'Pick a payment method to proceed to final confirmation.'}
      </p>
      <div className="space-y-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            disabled={actionsDisabled}
            onClick={() => onAction(`checkout_pay:${method.id}`, { id: `checkout_pay:${method.id}` })}
            className={[
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition active:scale-[0.99]',
              actionsDisabled ? 'cursor-not-allowed opacity-60' : '',
              method.id === 'cod'
                ? 'border-primary-300 bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/50',
            ].join(' ')}
          >
            <span className={[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              method.id === 'cod' ? 'bg-white/20' : 'bg-slate-100 text-primary-600',
            ].join(' ')}
            >
              {method.id === 'cod' ? <Truck className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{method.label}</span>
              {method.description && (
                <span className={`mt-0.5 block text-[11px] ${method.id === 'cod' ? 'text-primary-100' : 'text-text-muted'}`}>
                  {method.description}
                </span>
              )}
            </span>
            <ChevronLeft className={`h-4 w-4 shrink-0 opacity-60 ${isAr ? '' : 'rotate-180'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckoutConfirmBody({ message, isAr, onAction, disabled: actionsDisabled = false }) {
  const step = message.checkoutStep || 5;
  const total = message.checkoutStepsTotal || 5;
  const rows = message.infoRows || [];

  return (
    <div className="mt-1 space-y-3">
      <CheckoutStepIndicator
        step={step}
        total={total}
        label={isAr ? 'مراجعة وتأكيد الطلب' : 'Review & confirm order'}
        isAr={isAr}
      />
      <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-xs">
            <span className="shrink-0 text-text-muted">{row.label}</span>
            <span className="text-end font-semibold text-text">{row.value}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={() => onAction('checkout_place', { id: 'checkout_place', variant: 'primary' })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition hover:from-primary-600 hover:to-primary-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-5 w-5" />
        {isAr ? 'تأكيد وإتمام الطلب' : 'Confirm & place order'}
      </button>
      <p className="text-center text-[10px] text-text-muted">
        {isAr ? 'بالضغط أعلاه يتم إنشاء طلبك فوراً' : 'Your order will be placed immediately'}
      </p>
    </div>
  );
}

function ChatCartEditor({ items, isAr, subtotal, onUpdateQuantity, onRemoveItem }) {
  if (!items?.length) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-8 text-center">
        <ShoppingCart className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-text-muted">
          {isAr ? 'سلتك فارغة' : 'Your cart is empty'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1 max-h-[min(42vh,18rem)] space-y-2 overflow-y-auto scrollbar-thin">
      {items.map((item) => {
        const key = item.cartKey || item.productId;
        const name = isAr ? (item.name || item.nameEn) : (item.nameEn || item.name);
        const maxStock = item.availableStock;
        const atMax = maxStock != null && item.quantity >= maxStock;
        const lineTotal = calculatePromotedLineTotal(item);

        return (
          <article
            key={key}
            className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm"
          >
            <div className="flex gap-2.5">
              <ProductImage
                src={item.image}
                alt={name}
                emoji={item.emoji}
                className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-slate-100"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-text">{name}</p>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(key)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={isAr ? 'حذف' : 'Remove'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(key, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-white"
                      aria-label={isAr ? 'تقليل' : 'Decrease'}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[1.75rem] text-center text-xs font-bold tabular-nums text-text">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(key, item.quantity + 1)}
                      disabled={atMax}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={isAr ? 'زيادة' : 'Increase'}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-primary-700">
                    {formatPrice(lineTotal)}
                  </p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
      <div className="sticky bottom-0 flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2.5 ring-1 ring-primary-100">
        <span className="text-xs font-medium text-primary-900">{isAr ? 'الإجمالي' : 'Subtotal'}</span>
        <span className="text-sm font-bold tabular-nums text-primary-800">{formatPrice(subtotal)}</span>
      </div>
    </div>
  );
}

const ORDER_TONE_STYLES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  purple: 'bg-purple-50 text-purple-800 ring-purple-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

function OrdersBody({ orders, isAr, onAction }) {
  if (!orders?.length) return null;
  return (
    <div className="mt-3 max-h-[min(40vh,15rem)] space-y-2.5 overflow-y-auto overscroll-contain scrollbar-thin">
      {orders.map((order) => {
        const toneClass = ORDER_TONE_STYLES[order.statusTone] || ORDER_TONE_STYLES.amber;
        return (
          <div
            key={order.id}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 shadow-sm transition hover:border-primary-200/80 hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => onAction(`order:${order.id}`, { id: `order:${order.id}` })}
              className="flex w-full items-start justify-between gap-3 p-3.5 text-start"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold tracking-tight text-text">#{order.number}</p>
                  {order.itemSummary && (
                    <span className="text-[10px] font-medium text-text-muted">{order.itemSummary}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${toneClass}`}>
                    <span aria-hidden>{order.statusEmoji}</span>
                    {order.status}
                  </span>
                  {order.dateLabel && (
                    <span className="text-[10px] text-text-muted">{order.dateLabel}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-sm font-bold text-primary-600">{order.total}</p>
              </div>
            </button>
            {(order.canReorder || order.canTrack) && (
              <div className="flex gap-2 border-t border-slate-100 bg-white/70 px-3 py-2">
                {order.canReorder && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction(`reorder:${order.id}`, { id: `reorder:${order.id}` });
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 py-2 text-[11px] font-bold text-white transition hover:bg-primary-700"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {isAr ? 'إعادة الطلب' : 'Reorder'}
                  </button>
                )}
                {order.canTrack && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction(`track:${order.id}`, { id: `track:${order.id}`, href: `/orders/${order.id}?track=1` });
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    {isAr ? 'تتبع' : 'Track'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoRows({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-text-muted">{row.label}</span>
          <span className="font-semibold text-text">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChatBubble({
  message,
  isAr,
  language,
  location,
  onAction,
  onConfirmSchedule,
  onSaveAddress,
  savingAddress,
  liveCartItems,
  liveCartSubtotal,
  liveCartCount,
  onCartUpdateQuantity,
  onCartRemoveItem,
  mobileAddressMode = false,
  actionsDisabled = false,
}) {
  const isBot = message.role === 'bot';
  const isSuccess = message.layout === 'success';
  const isWelcome = message.layout === 'welcome';
  const isAiChat = message.layout === 'ai_chat';
  const isShopPanel = SHOP_PANEL_LAYOUTS.has(message.layout);

  const bubbleClass = [
    'rounded-2xl px-4 py-3.5 text-sm',
    (isWelcome || isShopPanel) ? 'w-full' : isAiChat ? 'max-w-[92%]' : 'max-w-[88%]',
    isBot
      ? 'rounded-tl-md bg-white text-text shadow-md shadow-slate-200/40 ring-1 ring-slate-100/80'
      : 'rounded-tr-md bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-md shadow-primary-900/15',
  ].join(' ');

  const titleText = message.sectionTitle || message.text;
  const headerSubtitle = message.layout === 'cart' && liveCartItems
    ? (liveCartItems.length
      ? (isAr
        ? `${liveCartCount} منتج — عدّل الكمية أو أكمل الشراء`
        : `${liveCartCount} item(s) — edit qty or checkout`)
      : (isAr ? 'أضف منتجات للمتابعة' : 'Add products to continue'))
    : (message.sectionSubtitle || (message.sectionTitle ? message.subtitle : undefined));
  const showHeader = isBot && (titleText || headerSubtitle) && (
    message.layout === 'shop_collections'
    || message.layout === 'category_browse'
    || message.layout === 'products'
    || message.layout === 'cart'
    || message.layout === 'checkout_addresses'
    || message.layout === 'checkout_delivery'
    || message.layout === 'checkout_delivery_schedule'
    || message.layout === 'checkout_payment'
    || message.layout === 'checkout_confirm'
    || message.layout === 'success'
    || (message.layout === 'info' && message.sectionTitle)
    || (message.layout === 'empty' && message.sectionTitle)
  );

  const body = (
    <div className={bubbleClass}>
        {isBot && isSuccess && (
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        )}

        {showHeader && (
          <ChatSectionHeader title={titleText} subtitle={headerSubtitle} isAr={isAr} />
        )}

        {message.text && !message.sectionTitle && (
          <p className={`whitespace-pre-wrap leading-relaxed ${
            isBot
              ? (message.layout === 'text' || message.layout === 'farewell' || message.layout === 'ai_chat'
                ? 'text-sm font-normal text-text'
                : 'text-base font-bold text-text')
              : 'text-sm font-semibold text-white'
          }`}>
            {message.text}
          </p>
        )}
        {message.subtitle && !showHeader && (
          <p className={`mt-1.5 text-xs leading-relaxed ${isBot ? 'text-text-muted' : 'text-primary-100'}`}>
            {message.subtitle}
          </p>
        )}

        {message.layout === 'welcome' && (
          <WelcomeBody message={message} isAr={isAr} onAction={onAction} />
        )}

        {message.layout === 'shop_collections' && (
          <ShopCollectionsBody message={message} isAr={isAr} onAction={onAction} />
        )}

        {message.layout === 'category_browse' && (
          <CategoryBrowseBody message={message} isAr={isAr} onAction={onAction} />
        )}

        {message.layout === 'products' && (
          <>
            <BrowseBreadcrumb segments={message.browseBreadcrumb} isAr={isAr} onAction={onAction} />
            {message.text && (message.sectionTitle || message.source === 'ai') && (
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-text">{message.text}</p>
            )}
            <ProductResults
              products={message.products}
              isAr={isAr}
              onAction={onAction}
              headerHref={message.viewAllHref}
              headerLabel={message.viewAllLabel}
              cartItems={liveCartItems}
              onUpdateQuantity={onCartUpdateQuantity}
            />
            <ActionGrid
              actions={message.actions?.filter((a) => !a.id.startsWith('add:') && !a.href)}
              isAr={isAr}
              onAction={onAction}
              variant="compact"
            />
          </>
        )}

        {message.layout === 'cart' && (
          <>
            <ChatCartEditor
              items={liveCartItems ?? message.cartItems}
              isAr={isAr}
              subtotal={liveCartSubtotal ?? message.cartSubtotal}
              onUpdateQuantity={onCartUpdateQuantity}
              onRemoveItem={onCartRemoveItem}
            />
            {(liveCartItems?.length ?? message.cartItems?.length) > 0 ? (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="menu" />
            ) : (
              <ActionGrid
                actions={[{ id: 'search', label: isAr ? 'ابحث عن منتج' : 'Search products', icon: 'search', variant: 'primary' }]}
                isAr={isAr}
                onAction={onAction}
                variant="menu"
              />
            )}
          </>
        )}

        {message.layout === 'checkout_addresses' && (
          <>
            <CheckoutAddressesBody message={message} isAr={isAr} onAction={onAction} disabled={actionsDisabled} />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
            )}
          </>
        )}

        {message.layout === 'checkout_delivery' && (
          <>
            <CheckoutDeliveryBody message={message} isAr={isAr} onAction={onAction} disabled={actionsDisabled} />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
            )}
          </>
        )}

        {message.layout === 'checkout_delivery_schedule' && (
          <>
            <CheckoutDeliveryScheduleBody
              message={message}
              isAr={isAr}
              language={language}
              location={location}
              onConfirmSchedule={onConfirmSchedule}
              disabled={actionsDisabled}
            />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
            )}
          </>
        )}

        {message.layout === 'checkout_payment' && (
          <>
            <CheckoutPaymentBody message={message} isAr={isAr} onAction={onAction} disabled={actionsDisabled} />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
            )}
          </>
        )}

        {message.layout === 'checkout_confirm' && (
          <>
            <CheckoutConfirmBody message={message} isAr={isAr} onAction={onAction} disabled={actionsDisabled} />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
            )}
          </>
        )}

        {message.layout === 'address_form' && (
          <>
            <CheckoutAddressForm
              message={message}
              isAr={isAr}
              onSave={onSaveAddress}
              saving={savingAddress}
              compactMobile={mobileAddressMode}
              onBack={mobileAddressMode ? () => onAction('back', { id: 'back' }) : undefined}
            />
            {!mobileAddressMode && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} />
            )}
          </>
        )}

        {message.layout === 'orders' && (
          <>
            <OrdersBody orders={message.orders} isAr={isAr} onAction={onAction} />
            {message.actions?.length > 0 && (
              <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} />
            )}
          </>
        )}

        {message.layout === 'order' && (
          <>
            <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2.5 text-xs ring-1 ring-slate-100">
              <div className="flex justify-between">
                <span className="text-text-muted">{isAr ? 'الحالة' : 'Status'}</span>
                <span className="font-semibold">{message.orderStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="font-bold text-primary-700">{message.orderTotal}</span>
              </div>
            </div>
            {message.orderNotes?.map((note) => (
              <p key={note} className="mt-2 text-[11px] text-amber-700">{note}</p>
            ))}
            <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} />
          </>
        )}

        {message.layout === 'info' && (
          <>
            <InfoRows rows={message.infoRows} />
            <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="menu" />
          </>
        )}

        {(message.layout === 'text' || message.layout === 'empty' || message.layout === 'search_prompt' || message.layout === 'farewell') && (
          <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} />
        )}

        {message.layout === 'ai_chat' && message.actions?.length > 0 && (
          <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="compact" />
        )}

        {message.layout === 'success' && (
          <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} variant="menu" />
        )}

        {!message.layout && message.actions?.length > 0 && (
          <ActionGrid actions={message.actions} isAr={isAr} onAction={onAction} />
        )}
    </div>
  );

  if (isWelcome) {
    return <div className="w-full">{body}</div>;
  }

  if (isShopPanel) {
    return (
      <div className="w-full">
        <div className="flex gap-2 justify-start">
          <BotAvatar size="sm" className="mt-1 shrink-0" />
          {body}
        </div>
      </div>
    );
  }

  if (isAiChat) {
    return (
      <div className="flex gap-2 justify-start">
        <BotAvatar size="sm" className="mt-1 shrink-0" />
        {body}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && <BotAvatar size="sm" className="mt-1" />}
      {body}
    </div>
  );
}

export default function SupportChatWidget() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { settings } = useStoreSettings();
  const { categoryTree, categories } = useCategories();
  const { location } = useDeliveryLocation();
  const {
    items,
    subtotal,
    total,
    totalItems,
    deliveryMethod,
    discountCode,
    addItem,
    openDrawer,
    clearCart,
    updateQuantity,
    removeItem,
  } = useCart();
  const {
    isOpen: open,
    setIsOpen: setOpen,
    consumeLaunchCheckoutAi,
  } = useSupportChat();
  const isAr = language === 'ar';
  const onCheckoutPage = pathname.startsWith('/checkout');
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatState, setChatState] = useState(createInitialChatState);
  const [initialized, setInitialized] = useState(false);
  const [unread, setUnread] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [cartNotice, setCartNotice] = useState(null);
  const [mobileChat, setMobileChat] = useState(() => isMobileChatViewport());

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const rootRef = useRef(null);
  const fabRef = useRef(null);
  const cartNoticeTimerRef = useRef(null);
  /** Set when server returns 503 — OpenAI not configured on backend */
  const aiOffRef = useRef(false);
  const userName = user?.name || user?.firstName || '';
  const isMobileOpen = open && mobileChat;
  const hasAddressForm = messages.some((m) => m.layout === 'address_form');
  const inCheckoutFlow = chatState.flow === FLOWS.CHECKOUT;
  const hideCheckoutChrome = hasAddressForm || inCheckoutFlow;
  const chatDisplayMessages = useMemo(() => {
    if (isMobileOpen && hasAddressForm) {
      return messages.filter((message) => message.layout === 'address_form');
    }
    if (inCheckoutFlow) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (CHECKOUT_PANEL_LAYOUTS.has(messages[index].layout)) {
          return [messages[index]];
        }
      }
    }
    return messages;
  }, [messages, isMobileOpen, hasAddressForm, inCheckoutFlow]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_CHAT_MQ);
    const sync = () => setMobileChat(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const appendChatMessages = useCallback((prev, incoming, nextState) => (
    mergeCheckoutChatMessages(prev, incoming, nextState)
  ), []);

  useEffect(() => {
    if (!isMobileOpen || !hasAddressForm) return undefined;
    const timer = window.setTimeout(() => {
      const list = listRef.current;
      const form = list?.querySelector('[data-support-chat-address-form]');
      if (list && form) list.scrollTop = Math.max(0, form.offsetTop - 16);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isMobileOpen, hasAddressForm, messages]);

  useEffect(() => {
    if (isMobileOpen && hasAddressForm) return;
    scrollToBottom();
  }, [chatDisplayMessages, typing, scrollToBottom, isMobileOpen, hasAddressForm]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  const dismissCartNotice = useCallback(() => {
    setCartNotice(null);
    if (cartNoticeTimerRef.current) {
      clearTimeout(cartNoticeTimerRef.current);
      cartNoticeTimerRef.current = null;
    }
  }, []);

  const showCartNotice = useCallback((productName) => {
    if (!productName) return;
    setCartNotice({ productName, at: Date.now() });
    if (cartNoticeTimerRef.current) clearTimeout(cartNoticeTimerRef.current);
    cartNoticeTimerRef.current = setTimeout(() => {
      setCartNotice(null);
      cartNoticeTimerRef.current = null;
    }, 5000);
  }, []);

  const handleAddToCartSideEffect = useCallback((sideEffect) => {
    if (sideEffect?.type !== 'add_to_cart' || !sideEffect.product) return;
    addItem(sideEffect.product, 1, false);
    const name = sideEffect.productName
      || (isAr
        ? (sideEffect.product.name || sideEffect.product.nameAr || sideEffect.product.nameEn)
        : (sideEffect.product.nameEn || sideEffect.product.name || sideEffect.product.nameAr));
    showCartNotice(name);
  }, [addItem, isAr, showCartNotice]);

  useEffect(() => {
    if (!totalItems) dismissCartNotice();
  }, [totalItems, dismissCartNotice]);

  useEffect(() => () => {
    if (cartNoticeTimerRef.current) clearTimeout(cartNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initApiConnection();
      if (cancelled) return;
      try {
        const status = await fetchAssistantStatus();
        if (cancelled) return;
        if (status?.enabled === false) aiOffRef.current = true;
        setAiEnabled(status?.enabled !== false);
      } catch {
        if (!cancelled) setAiEnabled(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open && !initialized) {
      setMessages(getWelcomeMessages(isAr, userName));
      setInitialized(true);
    }
  }, [open, initialized, isAr, userName]);

  useEffect(() => {
    if (!open) return undefined;
    setUnread(false);
    if (mobileChat) return undefined;
    const t = setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 200);
    return () => clearTimeout(t);
  }, [open, mobileChat]);

  /** Mobile only — freeze page scroll while chat is open */
  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const { style } = document.documentElement;
    const prev = style.overflow;
    style.overflow = 'hidden';

    return () => {
      style.overflow = prev;
    };
  }, [isMobileOpen]);

  /** Mobile only — size the chat sheet to the visible viewport (above keyboard) */
  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const root = rootRef.current;
    const vv = window.visualViewport;
    if (!root || !vv) return undefined;

    const syncViewport = () => {
      root.style.top = `${vv.offsetTop}px`;
      root.style.left = `${vv.offsetLeft}px`;
      root.style.width = `${vv.width}px`;
      root.style.height = `${vv.height}px`;
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);

    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      root.style.top = '';
      root.style.left = '';
      root.style.width = '';
      root.style.height = '';
    };
  }, [isMobileOpen]);

  const runProcessor = useCallback(async ({ text = '', actionId = '', checkoutDraftPatch = null } = {}) => {
    setTyping(true);
    const userText = text?.trim();
    let resolvedActionId = actionId;

    if (userText && !resolvedActionId) {
      const localAction = resolveLocalChatAction(userText, isAr);
      if (localAction) {
        resolvedActionId = localAction;
      }
    }

    const userMessages = userText
      ? [{ id: `user-${Date.now()}`, role: 'user', text: userText, at: Date.now() }]
      : [];

    try {
      // ChatGPT-style AI for all free-form text (unless backend confirmed OpenAI is off)
      const shouldTryAi = Boolean(userText) && !resolvedActionId && !aiOffRef.current;
      if (shouldTryAi) {
        try {
          const history = [...messages, ...userMessages]
            .filter((m) => m.role === 'user' || m.role === 'bot')
            .slice(-10)
            .map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: String(m.text || m.sectionTitle || m.sectionSubtitle || '').trim(),
            }))
            .filter((m) => m.content.length > 0);

          const data = await sendAssistantMessage({
            message: userText,
            history,
            locale: isAr ? 'ar' : 'en',
          });

          aiOffRef.current = false;
          setAiEnabled(true);
          const result = mapAssistantReply({ data, state: chatState, isAr });
          setChatState(result.state || chatState);
          setMessages((prev) => [...prev, ...userMessages, ...result.messages]);
          if (!open && result.messages.some((m) => m.role === 'bot')) setUnread(true);
          return;
        } catch (err) {
          const notConfigured = err?.status === 503;
          if (notConfigured) {
            aiOffRef.current = true;
            setAiEnabled(false);
            // Fall through to rule engine for this message only
          } else {
            const fallback = buildAssistantUnavailableReply(isAr, settings, err?.message, chatState);
            setChatState(fallback.state || chatState);
            setMessages((prev) => [...prev, ...userMessages, ...fallback.messages]);
            if (!open) setUnread(true);
            return;
          }
        }
      }

      if (userText && !resolvedActionId) {
        const textResult = await processChatInput({
          text,
          actionId: '',
          state: chatState,
          isAr,
          isAuthenticated,
          userName,
          settings,
          cart: { items, subtotal, total },
          categoryTree,
          categories,
          user,
          location,
        });
        setChatState(textResult.state || chatState);
        setMessages((prev) => appendChatMessages(prev, textResult.messages, textResult.state || chatState));
        handleAddToCartSideEffect(textResult.sideEffect);
        if (!open && textResult.messages.some((m) => m.role === 'bot')) setUnread(true);
        return;
      }

      const result = await processChatInput({
        text: resolvedActionId ? '' : text,
        actionId: resolvedActionId,
        state: chatState,
        isAr,
        isAuthenticated,
        userName,
        settings,
        cart: { items, subtotal, total },
        categoryTree,
        categories,
        user,
        location,
        checkoutDraftPatch,
      });
      const nextState = result.state || chatState;
      setChatState(nextState);
      setMessages((prev) => appendChatMessages(prev, result.messages, nextState));
      handleAddToCartSideEffect(result.sideEffect);
      if (result.sideEffect?.type === 'reorder' && result.sideEffect.order?.items?.length) {
        for (const item of result.sideEffect.order.items) {
          const product = {
            _id: item.productId || item.product?._id || item.product,
            name: item.name,
            nameAr: item.nameAr || item.name,
            nameEn: item.nameEn || item.name,
            price: item.price,
            image: item.image,
            emoji: item.emoji,
            slug: item.slug,
            variantId: item.variantId,
          };
          if (product._id) addItem(product, item.quantity || 1, false);
        }
        openDrawer();
      }
      if (result.sideEffect?.type === 'place_order' && result.sideEffect.checkoutDraft) {
        try {
          const draft = result.sideEffect.checkoutDraft;
          const data = await placeAssistantOrder({
            items,
            user,
            location,
            language,
            deliveryMethod: draft.deliveryMethod || deliveryMethod,
            discountCode,
            addressId: draft.addressId,
            paymentMethod: draft.paymentMethod,
            storeSettings: settings,
            scheduledDate: draft.scheduledDate,
            scheduledTime: draft.scheduledTime,
            recurringFrequency: draft.recurringFrequency,
            recurringPreferredWeekday: draft.recurringPreferredWeekday,
            recurringPreferredDayOfMonth: draft.recurringPreferredDayOfMonth,
          });
          const order = data?.order;
          clearCart();
          await refreshUser?.();
          setChatState(createInitialChatState());
          const num = formatOrderNumber(order?.orderNumber);
          setMessages((prev) => [
            ...prev.filter((message) => !CHECKOUT_PANEL_LAYOUTS.has(message.layout)),
            {
              id: `bot-order-placed-${Date.now()}`,
              role: 'bot',
              text: '',
              at: Date.now(),
              layout: 'success',
              sectionTitle: isAr ? `تم تأكيد طلبك #${num}` : `Order #${num} confirmed`,
              sectionSubtitle: isAr
                ? 'شكراً لك — يمكنك تتبع الطلب من حسابك'
                : 'Thank you — track your order from your account',
              actions: [
                { id: 'orders', label: isAr ? 'طلباتي' : 'My orders', icon: 'orders' },
                { id: 'menu', label: isAr ? 'القائمة' : 'Menu', icon: 'menu' },
              ],
            },
          ]);
          if (result.sideEffect.checkoutDraft.paymentMethod === 'stripe' && order?.id) {
            try {
              const { data: paymentData } = await paymentService.createCheckoutSession(order.id);
              if (paymentData?.url) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `bot-pay-stripe-${Date.now()}`,
                    role: 'bot',
                    text: isAr ? 'أكمل الدفع أونلاين' : 'Complete online payment',
                    at: Date.now(),
                    layout: 'info',
                    subtitle: isAr
                      ? 'تم إنشاء طلبك — اضغط لإتمام الدفع (سيفتح في نافذة جديدة)'
                      : 'Order created — tap to pay (opens in a new tab)',
                    actions: [
                      { id: 'stripe_pay', label: isAr ? 'ادفع الآن' : 'Pay now', icon: 'checkout', external: true, href: paymentData.url, variant: 'primary' },
                      { id: 'orders', label: isAr ? 'طلباتي' : 'My orders', icon: 'orders' },
                    ],
                  },
                ]);
                return;
              }
            } catch {
              // fall through to in-chat message
            }
          }
          // Stay in chat — no redirect for COD or after order placed
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-order-fail-${Date.now()}`,
              role: 'bot',
              text: isAr ? 'تعذّر إتمام الطلب' : 'Could not place order',
              at: Date.now(),
              layout: 'empty',
              subtitle: err?.message || (isAr ? 'حاول مرة أخرى أو أكمل في صفحة الدفع' : 'Try again or use the checkout page'),
              actions: [
                { id: 'checkout_place', label: isAr ? 'إعادة المحاولة' : 'Try again', icon: 'checkout', variant: 'primary' },
                { id: 'menu', label: isAr ? 'القائمة الرئيسية' : 'Main menu', icon: 'menu' },
                { id: 'browse_shop', label: isAr ? 'تسوق الآن' : 'Shop now', icon: 'browse' },
              ],
            },
          ]);
        }
      }
      if (!open && result.messages.some((m) => m.role === 'bot')) setUnread(true);
    } finally {
      setTyping(false);
    }
  }, [
    chatState, isAr, isAuthenticated, userName, settings, items, subtotal, total,
    addItem, open, aiEnabled, messages, categoryTree, categories, user, location,
    language, deliveryMethod, discountCode, clearCart, refreshUser, navigate, openDrawer,
    handleAddToCartSideEffect, appendChatMessages,
  ]);

  useEffect(() => {
    if (!open || !consumeLaunchCheckoutAi()) return;
    runProcessor({ actionId: 'checkout_ai' });
  }, [open, consumeLaunchCheckoutAi, runProcessor]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    await runProcessor({ text });
  };

  const handleSaveAddress = useCallback(async (payload) => {
    setSavingAddress(true);
    setTyping(true);
    try {
      const { data } = await authService.addAddress({ ...payload, lang: language });
      const savedUser = data?.user;
      const addresses = savedUser?.addresses || [];
      const newAddr = addresses.find((a) => a.isDefault) || addresses[addresses.length - 1];
      const addressId = newAddr?._id;

      await refreshUser?.();

      if (addressId && savedUser) {
        const result = await processChatInput({
          actionId: `checkout_addr:${addressId}`,
          state: chatState,
          isAr,
          isAuthenticated: true,
          userName: savedUser.name || savedUser.firstName || userName,
          settings,
          cart: { items, subtotal, total },
          categoryTree,
          categories,
          user: savedUser,
          location,
        });
        const nextState = result.state || chatState;
        setChatState(nextState);
        setMessages((prev) => appendChatMessages(
          prev.filter((message) => message.layout !== 'address_form'),
          [
            {
              id: `user-addr-saved-${Date.now()}`,
              role: 'user',
              text: [payload.street, payload.building, payload.area || payload.city].filter(Boolean).join(' · '),
              at: Date.now(),
            },
            ...result.messages,
          ],
          nextState,
        ));
        return;
      }

      const fallback = await processChatInput({
        actionId: 'checkout_ai',
        state: chatState,
        isAr,
        isAuthenticated: true,
        userName,
        settings,
        cart: { items, subtotal, total },
        categoryTree,
        categories,
        user: savedUser || user,
        location,
      });
      const fallbackState = fallback.state || chatState;
      setChatState(fallbackState);
      setMessages((prev) => appendChatMessages(
        prev.filter((message) => message.layout !== 'address_form'),
        fallback.messages,
        fallbackState,
      ));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-addr-fail-${Date.now()}`,
          role: 'bot',
          text: isAr ? 'تعذّر حفظ العنوان' : 'Could not save address',
          at: Date.now(),
          layout: 'empty',
          subtitle: err.response?.data?.message || err.message || (isAr ? 'تحقق من البيانات وحاول مرة أخرى' : 'Check the details and try again'),
          actions: [
            { id: 'checkout_add_address', label: isAr ? 'إعادة المحاولة' : 'Try again', icon: 'delivery', variant: 'primary' },
          ],
        },
      ]);
    } finally {
      setSavingAddress(false);
      setTyping(false);
    }
  }, [
    language, refreshUser, chatState, isAr, userName, settings, items, subtotal, total,
    categoryTree, categories, user, location, appendChatMessages,
  ]);

  const handleConfirmSchedule = useCallback(async (schedulePatch) => {
    await runProcessor({ actionId: 'checkout_schedule_confirm', checkoutDraftPatch: schedulePatch });
  }, [runProcessor]);

  const handleAction = async (actionId, action) => {
    if (chatState.flow === FLOWS.CHECKOUT && CHECKOUT_INTERRUPT_ACTIONS.has(actionId)) {
      return;
    }
    if (actionId === 'open_cart' || actionId === 'cart') {
      await runProcessor({ actionId: 'cart' });
      return;
    }
    if (actionId === 'begin_checkout' || actionId === 'checkout_ai') {
      await runProcessor({ actionId: 'checkout_ai' });
      return;
    }
    if (actionId === 'stripe_pay' && action?.external && action?.href) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (actionId === 'checkout_login') {
      navigate('/login', { state: { from: pathname, returnToChat: true } });
      return;
    }
    if (actionId === 'start_over') {
      setChatState(createInitialChatState());
      setMessages(getWelcomeMessages(isAr, userName));
      return;
    }
    if (action?.href) {
      if (action.href.startsWith('tel:') || action.href.startsWith('mailto:')) {
        window.location.href = action.href;
        return;
      }
      if (action.external) window.open(action.href, '_blank', 'noopener,noreferrer');
      else { navigate(action.href); }
      return;
    }
    await runProcessor({ actionId });
  };

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  // Hide only after settings loaded — avoid flash; admin can disable in Experience settings
  if (settings && settings.aiChatEnabled === false) return null;

  return (
    <>
      {open && (
        <div
          className={`pointer-events-none fixed inset-0 z-[59] bg-slate-900/20 transition-opacity ${isMobileOpen ? 'md:bg-slate-900/20' : ''}`}
          aria-hidden
        />
      )}
    <div
      ref={rootRef}
      className={
        isMobileOpen
          ? 'support-chat-mobile-sheet pointer-events-auto fixed z-[70] flex flex-col bg-white'
          : `pointer-events-none fixed z-[60] flex flex-col items-end left-auto right-4 ${
              onCheckoutPage
                ? 'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
                : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
            }`
      }
    >
      {open && (
        <div
          ref={panelRef}
          className={[
            'support-chat-panel pointer-events-auto flex flex-col overflow-hidden bg-white',
            isMobileOpen
              ? 'support-chat-mobile-sheet-panel min-h-0 flex-1 w-full max-h-none rounded-none shadow-none ring-0'
              : [
                  'mb-4 w-[min(100vw-2rem,24rem)] rounded-3xl shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200/80 sm:w-[26rem]',
                  onCheckoutPage
                    ? 'max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)-6.5rem)]'
                    : 'max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)-10.5rem)]',
                  'md:max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px)-5.5rem)]',
                ].join(' '),
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'مساعد المتجر' : 'Store assistant'}
        >
          <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-primary-600 via-primary-600 to-primary-800 px-4 py-3.5 text-white ${isMobileOpen ? 'pt-[max(0.875rem,env(safe-area-inset-top,0px))]' : ''}`}>
            <div className="pointer-events-none absolute -end-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                <AssistantMark className="h-6 w-6" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-primary-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {isAr ? 'مساعد المتجر الذكي' : 'Smart Store Assistant'}
                  <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                </p>
                <p className="mt-0.5 text-[11px] text-primary-100">
                  {typing
                    ? (aiEnabled !== false ? (isAr ? 'يفكر…' : 'Thinking…') : (isAr ? 'جاري البحث…' : 'Searching…'))
                    : (aiEnabled !== false
                      ? (isAr ? 'مساعد ذكي · متصل' : 'AI assistant · online')
                      : aiEnabled === false
                        ? (isAr ? 'مساعد المتجر · متصل' : 'Store assistant · online')
                        : (isAr ? 'جاري الاتصال…' : 'Connecting…'))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                aria-label={isAr ? 'تصغير' : 'Minimize'}
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            data-support-chat-scroll
            className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain bg-gradient-to-b from-slate-50/90 to-white px-3.5 py-4"
          >
            {chatDisplayMessages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                isAr={isAr}
                language={language}
                location={location}
                onAction={handleAction}
                onConfirmSchedule={handleConfirmSchedule}
                onSaveAddress={handleSaveAddress}
                savingAddress={savingAddress}
                liveCartItems={m.layout === 'cart' || m.layout === 'products' ? items : undefined}
                liveCartSubtotal={m.layout === 'cart' ? subtotal : undefined}
                liveCartCount={m.layout === 'cart' ? totalItems : undefined}
                onCartUpdateQuantity={updateQuantity}
                onCartRemoveItem={removeItem}
                mobileAddressMode={hideCheckoutChrome && m.layout === 'address_form'}
                actionsDisabled={typing}
              />
            ))}
            {typing && (
              <div className="flex gap-2">
                <BotAvatar size="sm" className="mt-1" />
                <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary-300 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {hasAddressForm && isMobileOpen && (
            <div className="shrink-0 border-t border-slate-100 bg-white p-3 md:hidden">
              <button
                type="submit"
                form="support-chat-address-form"
                disabled={savingAddress}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                <MapPin className="h-4 w-4" />
                {savingAddress
                  ? (isAr ? 'جاري الحفظ…' : 'Saving…')
                  : (isAr ? 'حفظ ومتابعة الطلب' : 'Save & continue')}
              </button>
            </div>
          )}

          {!hideCheckoutChrome && (
            <QuickMenuBar
              isAr={isAr}
              onAction={handleAction}
              disabled={typing}
            />
          )}

          {!hideCheckoutChrome && (
            <ChatFooterBar
              isAr={isAr}
              onAction={handleAction}
              disabled={typing}
              canGoBack={chatState.stack?.length > 0 || chatState.flow !== 'menu' || Boolean(chatState.browsePath)}
            />
          )}

          {!hideCheckoutChrome && (
            <ChatAddedToCartNotice
              isAr={isAr}
              productName={cartNotice?.productName}
              onViewCart={() => {
                dismissCartNotice();
                handleAction('cart', { id: 'cart' });
              }}
              onDismiss={dismissCartNotice}
            />
          )}

          {!hideCheckoutChrome && (
            <ChatCartCheckoutBar
              isAr={isAr}
              itemCount={totalItems}
              subtotal={subtotal}
              disabled={typing}
              onCheckout={() => handleAction('checkout_ai', { id: 'checkout_ai' })}
              onViewCart={() => handleAction('cart', { id: 'cart' })}
            />
          )}

          {inCheckoutFlow && !hasAddressForm && (
            <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-2.5">
              <button
                type="button"
                disabled={typing}
                onClick={() => handleAction('back', { id: 'back' })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {isAr ? 'رجوع' : 'Back'}
              </button>
            </div>
          )}

          {!hideCheckoutChrome && (
          <form onSubmit={handleSend} className="shrink-0 border-t border-slate-100 bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 focus-within:border-primary-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={preventMobileChatInputScroll}
                placeholder={isAr ? 'مثال: حليب، منظف، طلباتي…' : 'e.g. milk, detergent, my orders…'}
                disabled={typing}
                className="min-h-[2.5rem] flex-1 bg-transparent px-2.5 py-2 text-base md:text-sm focus:outline-none disabled:opacity-60"
                autoComplete="off"
                enterKeyHint="send"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md disabled:opacity-40"
                aria-label={isAr ? 'إرسال' : 'Send'}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
          )}
        </div>
      )}

      <div ref={fabRef} className={`pointer-events-auto ${isMobileOpen ? 'hidden md:block' : ''}`}>
        {!open ? (
          <>
            {/* Mobile — squircle orb */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="support-chat-fab-orb group relative flex h-14 w-14 items-center justify-center rounded-[18px] text-white sm:hidden"
              aria-expanded={false}
              aria-label={isAr ? 'فتح المساعد الذكي' : 'Open AI assistant'}
            >
              <span className="support-chat-fab-pulse pointer-events-none absolute inset-0 rounded-[18px] bg-white/25" aria-hidden />
              <span className="support-chat-launcher-shine rounded-[18px]" aria-hidden />
              <AssistantMark className="relative h-[1.625rem] w-[1.625rem]" />
              {unread && (
                <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>

            {/* Desktop — single gradient capsule */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="support-chat-launcher group relative hidden h-[3.25rem] flex-row-reverse items-center gap-3 overflow-hidden rounded-full pe-1.5 ps-5 text-white sm:flex"
              aria-expanded={false}
              aria-label={isAr ? 'فتح المساعد الذكي' : 'Open AI assistant'}
            >
              <span className="support-chat-fab-pulse pointer-events-none absolute inset-0 rounded-full bg-white/20" aria-hidden />
              <span className="support-chat-launcher-shine" aria-hidden />

              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
                <AssistantMark className="h-[1.125rem] w-[1.125rem]" />
                {unread && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-primary-600" />
                )}
              </span>

              <span className="relative flex min-w-0 flex-col items-end text-end leading-none">
                <span className="text-[13px] font-bold tracking-tight">
                  {isAr ? 'تحتاج مساعدة؟' : 'Need help?'}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-white/80">
                  <Sparkles className="h-3 w-3 shrink-0 text-amber-200" strokeWidth={2} />
                  {isAr ? 'اسأل المساعد الذكي' : 'Ask our AI assistant'}
                </span>
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="support-chat-fab-orb relative flex h-14 w-14 items-center justify-center rounded-[18px] text-white"
            aria-expanded={true}
            aria-label={isAr ? 'إغلاق المساعد' : 'Close assistant'}
          >
            <X className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
    </>
  );
}
