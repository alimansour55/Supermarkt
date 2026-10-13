import { useMemo, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import {
  BadgePercent, BarChart3, ClipboardList, HelpCircle, LifeBuoy, PackagePlus, Search, Tags, Truck, Wallet, Warehouse,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { Card, PageHeader } from '../ui';

const GUIDES = [
  { Icon: PackagePlus, to: '/seller-center/products/new', ar: 'إضافة منتج احترافي', en: 'Create a great listing', textAr: 'اسم واضح، 3 صور على الأقل، وصف ومواصفات.', textEn: 'Clear name, 3+ photos, description and specs.' },
  { Icon: Tags, to: '/seller-center/categories', ar: 'تنظيم متجرك بأقسام', en: 'Organise with sections', textAr: 'أقسامك تظهر كفلاتر في صفحة متجرك.', textEn: 'Your sections become filters on your store page.' },
  { Icon: Warehouse, to: '/seller-center/inventory', ar: 'تحديث الأسعار والمخزون', en: 'Update price & stock', textAr: 'عدّل عشرات المنتجات وحفظها مرة واحدة.', textEn: 'Edit many products and save them at once.' },
  { Icon: ClipboardList, to: '/seller-center/orders?status=pending', ar: 'تجهيز الطلبات وشحنها', en: 'Fulfil your orders', textAr: 'أكّد ← جهّز ← اشحن مع رقم التتبع.', textEn: 'Confirm → pack → ship with tracking.' },
  { Icon: Wallet, to: '/seller-center/finance', ar: 'متى تصلك أرباحك', en: 'When you get paid', textAr: 'الرصيد المتاح والتحويلات وكشف الحساب.', textEn: 'Available balance, payouts and statement.' },
  { Icon: BarChart3, to: '/seller-center/reports', ar: 'قراءة تقارير المبيعات', en: 'Read your sales reports', textAr: 'أفضل منتجاتك وأقسامك وأيام البيع.', textEn: 'Your best products, sections and days.' },
];

function faq(isAr, m, seller) {
  const rate = seller.commissionRate ?? m.defaultCommissionRate;
  return [
    {
      q: isAr ? 'كم عمولة المنصة؟' : 'What is the marketplace fee?',
      a: isAr
        ? `عمولتك ${rate}% من سعر بيع كل قطعة، وقد تختلف لبعض الأقسام. لا توجد رسوم اشتراك شهرية.`
        : `Your fee is ${rate}% of each item's selling price; some categories may differ. There is no monthly subscription.`,
    },
    {
      q: isAr ? 'متى أستلم أرباحي؟' : 'When do I get paid?',
      a: isAr
        ? `تصبح المبيعات متاحة للتحويل بعد ${m.payoutHoldDays} يوماً من التسليم (فترة الإرجاع)، ونحوّل لك عندما يصل رصيدك المتاح إلى ${formatPrice(m.minPayoutAmount || 0)} على الأقل.`
        : `Sales become payable ${m.payoutHoldDays} days after delivery (the return window). We pay you once your available balance reaches ${formatPrice(m.minPayoutAmount || 0)}.`,
    },
    {
      q: isAr ? 'ما الفرق بين "يشحنه البائع" و"يشحنه المتجر"؟' : 'Shipped by me vs shipped by the store?',
      a: isAr
        ? `يشحنه البائع: تحتفظ بالبضاعة وتوصّل الطلبات بنفسك (رسوم توصيل ${formatPrice(m.sellerShipmentDeliveryFee || 0)} لكل شحنة تُضاف لك). يشحنه المتجر: ترسل بضاعتك لمخزننا ونحن نغلّف ونوصّل مقابل ${formatPrice(m.storeFulfillmentFeePerItem || 0)} لكل قطعة.`
        : `Shipped by you: you keep stock and deliver yourself (a ${formatPrice(m.sellerShipmentDeliveryFee || 0)} delivery fee per shipment is credited to you). Shipped by the store: send stock to our warehouse and we pack and deliver for ${formatPrice(m.storeFulfillmentFeePerItem || 0)} per item.`,
    },
    {
      q: isAr ? 'لماذا رُفض منتجي؟' : 'Why was my product rejected?',
      a: isAr
        ? 'ستجد سبب الرفض في صفحة المنتج. الأسباب الشائعة: صور غير واضحة، اسم غير دقيق، أو منتج مخالف للسياسات. عدّل وأعد الإرسال.'
        : "The reason is shown on the product page. Common causes: unclear photos, an inaccurate name, or a restricted product. Fix it and resubmit.",
    },
    {
      q: isAr ? 'ماذا لو لم أجد قسماً مناسباً لمنتجي؟' : "My product doesn't fit any category",
      a: isAr
        ? 'اترك "قسم المنصة" فارغاً واكتب اقتراحاً — سيضع فريق المراجعة منتجك في القسم الصحيح. ويمكنك دائماً إنشاء أقسام متجرك الخاصة.'
        : 'Leave the marketplace category empty and type a suggestion — our review team will place it. You can always create your own store sections too.',
    },
    {
      q: isAr ? 'هل تحتاج تعديلاتي على منتج معروض لمراجعة؟' : 'Do edits to a live product need review?',
      a: isAr
        ? 'السعر والمخزون وأقسام متجرك تُطبّق فوراً. الاسم والوصف والصور وقسم المنصة تُراجع قبل ظهورها، ويبقى المنتج معروضاً بالنسخة الحالية.'
        : 'Price, stock and your sections apply instantly. Name, description, photos and marketplace category are reviewed first; the current version stays live meanwhile.',
    },
    {
      q: isAr ? 'كيف أتجنب إيقاف حسابي؟' : 'How do I keep my account healthy?',
      a: isAr
        ? 'حافظ على معدل إلغاء أقل من 2.5%، وشحن متأخر أقل من 4%، وتقييم 3.5 أو أكثر. تابعها في صفحة صحة الحساب.'
        : 'Keep cancellations under 2.5%, late shipments under 4% and your rating at 3.5+. Track them on the Account health page.',
    },
    {
      q: isAr ? 'هل يمكن لموظفين الدخول لمتجري؟' : 'Can my staff sign in?',
      a: isAr
        ? 'نعم — من إعدادات المتجر ← فريق العمل. الموظفون يديرون المنتجات والطلبات، أما البنك والفريق فللمالك فقط.'
        : 'Yes — Store settings → Team. Staff manage products and orders; bank details and the team stay owner-only.',
    },
  ];
}

export default function SellerHelpPage() {
  const { isAr, me, seller } = useOutletContext();
  const [q, setQ] = useState('');
  const items = useMemo(() => faq(isAr, me.marketplace, seller), [isAr, me.marketplace, seller]);
  const shown = items.filter((i) => !q.trim() || `${i.q} ${i.a}`.toLowerCase().includes(q.trim().toLowerCase()));
  const rate = seller.commissionRate ?? me.marketplace.defaultCommissionRate;

  return (
    <div className="space-y-6">
      <PageHeader icon={HelpCircle} title={isAr ? 'مركز المساعدة' : 'Help center'} description={isAr ? 'أدلة سريعة، الرسوم، والأسئلة الشائعة لبائعي المنصة.' : 'Quick guides, fees and answers for marketplace sellers.'} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <BadgePercent className="h-6 w-6 text-indigo-600" />
          <p className="mt-2 text-sm text-slate-500">{isAr ? 'عمولة البيع' : 'Selling fee'}</p>
          <p className="text-2xl font-extrabold">{rate}%</p>
          <p className="text-xs text-slate-500">{isAr ? 'لكل قطعة مباعة' : 'per item sold'}</p>
        </Card>
        <Card>
          <Wallet className="h-6 w-6 text-emerald-600" />
          <p className="mt-2 text-sm text-slate-500">{isAr ? 'فترة الانتظار' : 'Payout hold'}</p>
          <p className="text-2xl font-extrabold">{me.marketplace.payoutHoldDays} {isAr ? 'يوم' : 'days'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'بعد التسليم' : 'after delivery'}</p>
        </Card>
        <Card>
          <Truck className="h-6 w-6 text-violet-600" />
          <p className="mt-2 text-sm text-slate-500">{isAr ? 'مدة التجهيز لديك' : 'Your handling time'}</p>
          <p className="text-2xl font-extrabold">{seller.handlingDays} {isAr ? 'يوم' : 'day(s)'}</p>
          <p className="text-xs text-slate-500">{isAr ? 'قبل الشحن' : 'before shipping'}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-bold">{isAr ? 'أدلة سريعة' : 'Quick guides'}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <Link key={g.to} to={g.to} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
              <span className="h-fit rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><g.Icon className="h-5 w-5" /></span>
              <span>
                <span className="block font-semibold">{isAr ? g.ar : g.en}</span>
                <span className="block text-sm text-slate-500">{isAr ? g.textAr : g.textEn}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Card title={isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions'}>
        <label className="relative mb-4 block">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAr ? 'ابحث في الأسئلة…' : 'Search questions…'} className="w-full rounded-xl border border-slate-200 py-2 pe-3 ps-9 text-sm" />
        </label>
        <div className="divide-y divide-slate-100">
          {shown.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {item.q}
                <span className="text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
          {shown.length === 0 && <p className="py-4 text-sm text-slate-500">{isAr ? 'لا توجد نتائج.' : 'No results.'}</p>}
        </div>
      </Card>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white">
        <LifeBuoy className="h-8 w-8 text-indigo-300" />
        <div className="flex-1">
          <p className="font-bold">{isAr ? 'لم تجد إجابتك؟' : "Didn't find your answer?"}</p>
          <p className="text-sm text-slate-300">{isAr ? 'فريق دعم البائعين جاهز لمساعدتك.' : 'Our seller support team is here to help.'}</p>
        </div>
        <a href={`/${isAr ? 'ar' : 'en'}/contact`} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-indigo-50">
          {isAr ? 'تواصل مع الدعم' : 'Contact support'}
        </a>
      </section>
    </div>
  );
}
