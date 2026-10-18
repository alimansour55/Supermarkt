import {
  Apple, Award, BadgeCheck, Baby, Banknote, Beef, Bell, Boxes, Building2, Cake, CalendarDays, Candy, Carrot,
  CheckCircle2, Clock, Coffee, Coins, Cookie, CreditCard, Croissant, Crown, CupSoda, Dog, Droplets, Drumstick, Egg,
  Fish, Flame, Flower2, Gem, Gift, GraduationCap, Headphones, Heart, HelpCircle, Home, IceCreamCone, Image, Info,
  LayoutGrid, Leaf, Lightbulb, Lock, Mail, MapPin, Megaphone, MessageCircle, Milk, Moon, Package, PartyPopper,
  Percent, Phone, Pill, Pizza, Play, Receipt, Repeat, RotateCcw, Salad, Search, Share2, ShieldCheck, ShoppingBag,
  ShoppingCart, Smartphone, Smile, Snowflake, Sparkles, SprayCan, Star, Store, Sun, Tag, ThumbsUp, Ticket, Timer,
  Truck, User, Users, Wallet, WashingMachine, Wheat, Zap,
} from 'lucide-react';
import { resolveShopIcon } from '../../utils/shopIconKeys';

const SHOP_ICON_COMPONENTS = {
  truck: Truck, fast: Zap, clock: Clock, timer: Timer, calendar: CalendarDays, pin: MapPin, repeat: Repeat,
  returns: RotateCcw, support: Headphones, chat: MessageCircle, phone: Phone, mail: Mail, app: Smartphone,
  store: Store, branch: Building2,
  shield: ShieldCheck, lock: Lock, check: CheckCircle2, badge: BadgeCheck, award: Award, thumbs: ThumbsUp,
  smile: Smile, heart: Heart, star: Star, crown: Crown,
  tag: Tag, percent: Percent, flame: Flame, gift: Gift, coins: Coins, cash: Banknote, card: CreditCard,
  wallet: Wallet, ticket: Ticket, gem: Gem, sparkles: Sparkles, megaphone: Megaphone, share: Share2, receipt: Receipt,
  cart: ShoppingCart, bag: ShoppingBag, package: Package, boxes: Boxes, search: Search, grid: LayoutGrid,
  user: User, users: Users, bell: Bell, help: HelpCircle, info: Info, idea: Lightbulb, image: Image, video: Play,
  home: Home,
  leaf: Leaf, apple: Apple, carrot: Carrot, salad: Salad, milk: Milk, egg: Egg, bread: Croissant, wheat: Wheat,
  meat: Beef, chicken: Drumstick, fish: Fish, frozen: Snowflake, coffee: Coffee, drink: CupSoda, water: Droplets,
  cake: Cake, candy: Candy, cookie: Cookie, icecream: IceCreamCone, pizza: Pizza,
  clean: SprayCan, laundry: WashingMachine, baby: Baby, health: Pill, beauty: Flower2, pet: Dog, moon: Moon,
  sun: Sun, party: PartyPopper, school: GraduationCap,
};

/**
 * Draws a stored section icon as a line icon. Accepts an icon name, or an emoji
 * saved by the old builder (mapped to its closest icon). Draws nothing when the
 * value is empty or unknown, unless `fallback` names an icon.
 */
export default function ShopIcon({ name, fallback = '', className = 'h-5 w-5', strokeWidth = 1.75 }) {
  const Icon = SHOP_ICON_COMPONENTS[resolveShopIcon(name, fallback)];
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}

const BADGE_TONES = {
  soft: 'bg-primary-50 text-primary-700 ring-1 ring-primary-100',
  solid: 'bg-primary-600 text-white shadow-sm',
  onColor: 'bg-white/20 text-white',
  plain: 'text-current',
};
const BADGE_SIZES = {
  sm: ['h-7 w-7 rounded-lg', 'h-4 w-4'],
  md: ['h-9 w-9 rounded-xl', 'h-5 w-5'],
  lg: ['h-12 w-12 rounded-2xl', 'h-6 w-6'],
};

/** A section icon inside a rounded tinted square; draws nothing when there is no icon. */
export function ShopIconBadge({ name, fallback = '', tone = 'soft', size = 'md', className = '' }) {
  const Icon = SHOP_ICON_COMPONENTS[resolveShopIcon(name, fallback)];
  if (!Icon) return null;
  const [box, glyph] = BADGE_SIZES[size] || BADGE_SIZES.md;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${BADGE_TONES[tone] || BADGE_TONES.soft} ${className}`} aria-hidden>
      <Icon className={glyph} strokeWidth={1.75} />
    </span>
  );
}
