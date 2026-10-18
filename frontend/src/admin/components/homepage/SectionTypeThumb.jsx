import { ChevronDown, MapPin, Play, Star, Truck, User } from 'lucide-react';
import ShopIcon from '../../../components/ui/ShopIcon';

/**
 * Small drawn picture of what a section looks like on the storefront, for the
 * section library. Plain blocks in the store colours — no screenshots to go stale.
 */

const line = (w, tone = 'bg-slate-300') => <span className={`block h-1 rounded-full ${tone}`} style={{ width: w }} />;

function Products({ count = 4, tag = null }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-1">
        {line('34%', 'bg-slate-400')}
        {tag}
      </div>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="flex flex-col gap-0.5 rounded-md bg-white p-1 ring-1 ring-slate-200">
            <span className="block flex-1 rounded bg-slate-100" />
            {line('80%')}
            {line('45%', 'bg-primary-300')}
          </span>
        ))}
      </div>
    </div>
  );
}

const KIND_BY_TYPE = {
  hero_slider: 'slideshow', image_strip: 'bannerGroup', sidebar_banners: 'bannerGroup', promo_grid: 'bannerGroup',
  announcement_strip: 'bar', flash_strip: 'bar', split_promo: 'twoCards', video_banner: 'video',
  daily_offers: 'deals', flash_sale: 'deals', countdown_banner: 'countdown', offers_banner: 'bigCard',
  product_grid: 'products', product_carousel: 'products', top_rated: 'products', category_spotlight: 'products',
  tabbed_products: 'tabs', categories_scroll: 'circles', browse_hub: 'shortcuts', top_categories: 'shortcuts',
  subcategories_preview: 'shortcuts', all_products_entry: 'shortcuts', brand_row: 'brands', price_ranges: 'priceTiles',
  trending_searches: 'chips', recently_viewed: 'personal', picked_for_you: 'personal', buy_again: 'personal',
  trust_badges: 'iconRow', feature_cards: 'cards', stats_bar: 'numbers', reviews_carousel: 'reviews',
  store_branches: 'branches', free_delivery_banner: 'progress', delivery_area_bar: 'area', cta_card: 'cta',
  loyalty_promo: 'cta', recurring_promo: 'cta', signup_promo: 'cta', favorites_promo: 'cta', track_order_promo: 'cta',
  dual_cta: 'twoButtons', app_download: 'app', signup_block: 'email', faq_teaser: 'faq', rich_text_block: 'text',
  seo_text: 'text', coupon_card: 'coupon', occasion_tiles: 'occasions', delivery_slot_bar: 'slot',
  share_earn_promo: 'cta', spacer: 'spacer',
};

function drawing(kind, icon) {
  switch (kind) {
    case 'slideshow':
      return (
        <div className="relative flex flex-1 flex-col justify-end gap-1 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 p-2">
          {line('45%', 'bg-white/90')}
          {line('30%', 'bg-white/60')}
          <span className="mt-0.5 block h-2 w-8 rounded bg-white" />
          <span className="absolute bottom-1.5 end-2 flex gap-0.5">
            <span className="h-1 w-2.5 rounded-full bg-white" />
            <span className="h-1 w-1 rounded-full bg-white/60" />
            <span className="h-1 w-1 rounded-full bg-white/60" />
          </span>
        </div>
      );
    case 'bar':
      return (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <span className="flex items-center justify-center gap-1.5 rounded-md bg-primary-600 px-2 py-1.5">
            <ShopIcon name={icon} className="h-3 w-3 text-white" />
            {line('40%', 'bg-white/90')}
          </span>
          <span className="block h-6 rounded-md bg-slate-100" />
        </div>
      );
    case 'bannerGroup':
      return (
        <div className="grid flex-1 grid-cols-3 gap-1">
          <span className="rounded-md bg-gradient-to-br from-amber-300 to-orange-400" />
          <span className="rounded-md bg-gradient-to-br from-sky-300 to-blue-400" />
          <span className="rounded-md bg-gradient-to-br from-emerald-300 to-teal-400" />
        </div>
      );
    case 'twoCards':
      return (
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          {['bg-primary-100', 'bg-emerald-100'].map((bg) => (
            <span key={bg} className={`flex flex-col justify-end gap-1 rounded-lg p-1.5 ${bg}`}>
              {line('70%', 'bg-slate-500')}
              {line('45%', 'bg-slate-400')}
              <span className="mt-0.5 block h-1.5 w-6 rounded bg-slate-700" />
            </span>
          ))}
        </div>
      );
    case 'video':
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
            <Play className="h-3 w-3 fill-slate-800 text-slate-800" />
          </span>
        </div>
      );
    case 'deals':
      return (
        <div className="flex flex-1 flex-col gap-1 rounded-lg bg-orange-50 p-1">
          <div className="flex items-center justify-between">
            {line('30%', 'bg-orange-400')}
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2.5 rounded-sm bg-orange-500" />)}
            </span>
          </div>
          <Products count={4} />
        </div>
      );
    case 'countdown':
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500">
          {line('45%', 'bg-white/90')}
          <span className="flex gap-1">
            {[0, 1, 2, 3].map((i) => <span key={i} className="h-4 w-4 rounded bg-white/90" />)}
          </span>
        </div>
      );
    case 'bigCard':
      return (
        <div className="flex flex-1 items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-fuchsia-500 p-2">
          <span className="flex flex-1 flex-col gap-1">{line('70%', 'bg-white/90')}{line('45%', 'bg-white/60')}</span>
          <span className="block h-3 w-8 rounded bg-white" />
        </div>
      );
    case 'products':
      return <Products count={4} />;
    case 'personal':
      return (
        <Products
          count={4}
          tag={<User className="h-2.5 w-2.5 text-primary-500" />}
        />
      );
    case 'tabs':
      return (
        <div className="flex flex-1 flex-col gap-1">
          <span className="flex gap-1">
            <span className="h-2 w-7 rounded-full bg-primary-600" />
            <span className="h-2 w-6 rounded-full bg-slate-200" />
            <span className="h-2 w-6 rounded-full bg-slate-200" />
          </span>
          <Products count={4} />
        </div>
      );
    case 'circles':
      return (
        <div className="flex flex-1 items-center justify-between gap-1 px-0.5">
          {['bg-amber-200', 'bg-emerald-200', 'bg-sky-200', 'bg-rose-200', 'bg-violet-200'].map((bg) => (
            <span key={bg} className="flex flex-col items-center gap-1">
              <span className={`h-7 w-7 rounded-full ${bg}`} />
              {line('18px')}
            </span>
          ))}
        </div>
      );
    case 'shortcuts':
      return (
        <div className="grid flex-1 grid-cols-[1.1fr_1fr] gap-1">
          <span className="flex flex-col justify-end gap-1 rounded-lg bg-primary-600 p-1.5">
            {line('70%', 'bg-white/90')}
            <span className="block h-1.5 w-6 rounded bg-white" />
          </span>
          <span className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="rounded bg-slate-200" />)}
          </span>
        </div>
      );
    case 'brands':
      return (
        <div className="flex flex-1 items-center gap-1">
          {['A', 'B', 'C', 'D', 'E'].map((l) => (
            <span key={l} className="flex h-8 flex-1 items-center justify-center rounded-md bg-white text-[9px] font-extrabold text-slate-500 ring-1 ring-slate-200">{l}</span>
          ))}
        </div>
      );
    case 'priceTiles':
      return (
        <div className="grid flex-1 grid-cols-4 gap-1">
          {['bg-emerald-100', 'bg-sky-100', 'bg-amber-100', 'bg-violet-100'].map((bg) => (
            <span key={bg} className={`flex flex-col justify-center gap-1 rounded-md p-1 ${bg}`}>{line('80%', 'bg-slate-500')}</span>
          ))}
        </div>
      );
    case 'chips':
      return (
        <div className="flex flex-1 flex-col gap-1.5">
          {line('34%', 'bg-slate-400')}
          <span className="flex flex-wrap gap-1">
            {[28, 20, 34, 24, 18].map((w) => <span key={w} className="h-2.5 rounded-full bg-white ring-1 ring-slate-300" style={{ width: w }} />)}
          </span>
          <span className="grid flex-1 grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="rounded bg-slate-100" />)}</span>
        </div>
      );
    case 'iconRow':
      return (
        <div className="grid flex-1 grid-cols-4 gap-1">
          {['truck', 'lock', 'returns', 'check'].map((n) => (
            <span key={n} className="flex flex-col items-center justify-center gap-1 rounded-md bg-white ring-1 ring-slate-200">
              <ShopIcon name={n} className="h-3.5 w-3.5 text-primary-600" />
              {line('60%')}
            </span>
          ))}
        </div>
      );
    case 'cards':
      return (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {['coins', 'home', 'gift'].map((n) => (
            <span key={n} className="flex flex-col gap-1 rounded-md bg-white p-1.5 ring-1 ring-slate-200">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-primary-50"><ShopIcon name={n} className="h-2.5 w-2.5 text-primary-600" /></span>
              {line('80%', 'bg-slate-400')}
              {line('60%')}
            </span>
          ))}
        </div>
      );
    case 'numbers':
      return (
        <div className="grid flex-1 grid-cols-4 items-center gap-1 rounded-lg bg-primary-800 px-1.5">
          {['1K+', '50K', '24h', '100'].map((n) => (
            <span key={n} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-extrabold leading-none text-white">{n}</span>
              {line('70%', 'bg-white/50')}
            </span>
          ))}
        </div>
      );
    case 'reviews':
      return (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-col gap-1 rounded-md bg-white p-1.5 ring-1 ring-slate-200">
              <span className="flex gap-px">{[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-2 w-2 fill-amber-400 text-amber-400" />)}</span>
              {line('90%')}
              {line('70%')}
            </span>
          ))}
        </div>
      );
    case 'branches':
      return (
        <div className="grid flex-1 grid-cols-2 gap-1">
          {[0, 1].map((i) => (
            <span key={i} className="flex gap-1.5 rounded-md bg-white p-1.5 ring-1 ring-slate-200">
              <span className="flex h-full w-6 items-center justify-center rounded bg-emerald-100"><MapPin className="h-3 w-3 text-emerald-700" /></span>
              <span className="flex flex-1 flex-col justify-center gap-1">{line('80%', 'bg-slate-400')}{line('55%')}<span className="h-1.5 w-6 rounded-full bg-emerald-400" /></span>
            </span>
          ))}
        </div>
      );
    case 'progress':
      return (
        <div className="flex flex-1 flex-col justify-center gap-1.5 rounded-lg bg-emerald-50 px-2">
          <span className="flex items-center gap-1.5"><Truck className="h-3 w-3 text-emerald-700" />{line('55%', 'bg-emerald-700/60')}</span>
          <span className="block h-1.5 rounded-full bg-emerald-100"><span className="block h-full w-2/3 rounded-full bg-emerald-500" /></span>
        </div>
      );
    case 'area':
      return (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200">
            <MapPin className="h-3 w-3 text-primary-600" />
            {line('45%', 'bg-slate-400')}
            <ChevronDown className="ms-auto h-3 w-3 text-slate-400" />
          </span>
          <span className="block h-5 rounded-md bg-slate-100" />
        </div>
      );
    case 'cta':
      return (
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600"><ShopIcon name={icon} className="h-3.5 w-3.5 text-white" /></span>
          <span className="flex flex-1 flex-col gap-1">{line('75%', 'bg-slate-500')}{line('50%')}</span>
          <span className="block h-3 w-7 rounded bg-primary-600" />
        </div>
      );
    case 'twoButtons':
      return (
        <div className="grid flex-1 grid-cols-2 items-center gap-1.5">
          {['flame', 'cart'].map((n) => (
            <span key={n} className="flex items-center gap-1.5 rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-100"><ShopIcon name={n} className="h-3 w-3 text-primary-700" /></span>
              {line('50%', 'bg-slate-500')}
            </span>
          ))}
        </div>
      );
    case 'app':
      return (
        <div className="flex flex-1 items-center justify-between gap-2 rounded-lg bg-slate-800 p-2">
          <span className="flex flex-1 flex-col gap-1">{line('70%', 'bg-white/80')}{line('45%', 'bg-white/50')}</span>
          <span className="flex flex-col gap-1"><span className="h-2.5 w-9 rounded bg-white" /><span className="h-2.5 w-9 rounded bg-white" /></span>
        </div>
      );
    case 'email':
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg bg-primary-50">
          {line('50%', 'bg-slate-500')}
          <span className="flex w-3/4 gap-1"><span className="h-3 flex-1 rounded bg-white ring-1 ring-slate-300" /><span className="h-3 w-8 rounded bg-primary-600" /></span>
        </div>
      );
    case 'faq':
      return (
        <div className="flex flex-1 flex-col justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center justify-between rounded bg-white px-1.5 py-1 ring-1 ring-slate-200">
              {line('55%', 'bg-slate-400')}
              <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
            </span>
          ))}
        </div>
      );
    case 'coupon':
      return (
        <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50 px-2">
          <span className="flex flex-1 flex-col gap-1">{line('60%', 'bg-primary-400')}{line('40%')}</span>
          <span className="rounded border border-dashed border-primary-400 bg-white px-1.5 py-0.5 font-mono text-[8px] font-extrabold text-primary-700">SAVE20</span>
        </div>
      );
    case 'occasions':
      return (
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[['moon', 'bg-amber-100'], ['school', 'bg-sky-100'], ['party', 'bg-rose-100'], ['salad', 'bg-emerald-100']].map(([n, bg]) => (
            <span key={n} className={`flex flex-col justify-between rounded-md p-1 ${bg}`}>
              <ShopIcon name={n} className="h-3 w-3 text-slate-600" />
              {line('75%', 'bg-slate-500')}
            </span>
          ))}
        </div>
      );
    case 'slot':
      return (
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-emerald-50 px-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600"><ShopIcon name="clock" className="h-3 w-3 text-white" /></span>
          <span className="flex flex-1 flex-col gap-1">{line('40%', 'bg-emerald-600/50')}{line('65%', 'bg-slate-500')}</span>
          <MapPin className="h-3 w-3 text-emerald-700" />
        </div>
      );
    case 'spacer':
      return (
        <div className="flex flex-1 flex-col justify-between">
          <span className="block h-4 rounded bg-slate-200" />
          <span className="block border-t border-dashed border-slate-300" />
          <span className="block h-4 rounded bg-slate-200" />
        </div>
      );
    case 'text':
    default:
      return (
        <div className="flex flex-1 flex-col justify-center gap-1 px-1">
          {line('40%', 'bg-slate-500')}
          {line('95%')}
          {line('90%')}
          {line('70%')}
        </div>
      );
  }
}

export default function SectionTypeThumb({ type, icon }) {
  return (
    <div className="flex h-20 w-full overflow-hidden rounded-lg bg-white p-2 ring-1 ring-inset ring-slate-200/70" aria-hidden>
      {drawing(KIND_BY_TYPE[type] || 'text', icon)}
    </div>
  );
}
