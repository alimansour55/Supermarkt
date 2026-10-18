# Homepage sections — rework plan

## Status (2026-10-17, uncommitted on feat/pos-integrations)
- Done: phases 0–4, plus phase 5's new types (coupon card, shop by occasion, next delivery time,
  share & earn, spacer) and a section-aware list editor (trust badges, perks, numbers, two buttons).
- Not done: "bundle" type (needs the promotions bundle rules), deeper product-row options
  (out-of-stock hiding, add-to-cart toggle), emoji on product cards without photos and on
  category icons (catalog data used site-wide, outside the homepage library).

## Phase 0 — The delivery bar that would not go away
The pale bar under the header ("أقرب موعد توصيل: خلال ساعتين") is part of the **header**, not a
homepage section. Deleting the "free delivery" homepage section does not touch it, and the header
editor had no off switch for it (clearing its text only brings back the automatic delivery message).

Fix: Header & Footer editor → the bar → new switches:
- Show the bar (on/off)
- Show the "free delivery over X" note (on/off)
On phones the bar also holds the delivery-area picker, so when it is off phones keep only the slim
area picker line.

## Phase 1 — Bring in the 10 newer section types
They were built on `admin/homepage-sections` (countdown, video, tabbed products, shop by price,
reviews, sign-up, branches, recently viewed, picked for you, buy again) but never merged here.

## Phase 2 — Plain names and goal-based groups
Groups follow what the owner wants to do, not how the code is built:

| Group | Sections |
|---|---|
| أعلى الصفحة · Top of page | عرض الصور الرئيسي · Main slideshow; شريط رسالة · Message bar; مجموعة إعلانات · Banner group; إعلانان متجاوران · Two promo cards |
| بيع العروض · Sell deals | عروض اليوم · Today's deals; عدّ تنازلي · Countdown; إعلان صفحة العروض · Offers page banner; كوبون خصم · Coupon card (new) |
| ساعد الزبون يلاقي · Help shoppers find | أيقونات الأقسام · Category icons; لوحة التسوّق السريع · Shopping shortcuts; قسم في الواجهة · Featured category; العلامات التجارية · Brands; تسوّق حسب السعر · Shop by price; ما يبحث عنه الناس · Popular searches; تسوّق حسب المناسبة · Shop by occasion (new) |
| منتجات · Products | صف منتجات · Product row; منتجات بتبويبات · Product tabs; اشترِ معاً ووفّر · Bundle (new) |
| خاص بكل زبون · Personal | شاهدتها مؤخراً · Recently viewed; مختارة لك · Picked for you; اطلبها مرة أخرى · Buy again |
| طمأنة الزبون · Build trust | لماذا تتسوّق معنا · Why shop with us; أرقامنا · Our numbers; مميزات المتجر · Store perks; آراء العملاء · Customer reviews; فروعنا · Our branches |
| التوصيل · Delivery | كم باقي للتوصيل المجاني · Free delivery progress; اختر منطقة التوصيل · Pick delivery area; أقرب موعد توصيل · Next delivery slot (new) |
| ادعُ الزبون لخطوة · Ask for an action | بطاقة بزر · Card with button; زرّان كبيران · Two big buttons; نقاطي ومكافآتي · Points & rewards; اطلبها كل أسبوع · Repeat delivery; حمّل التطبيق · Get the app; ادعُ الزوار للتسجيل · Sign-up invite; اشترك في العروض · Get deals by email/WhatsApp; تذكير بالمفضلة · Favorites reminder; تتبّع طلبك · Track your order; شارك واربح · Share & earn (new) |
| نصوص · Text & media | فقرة نصية · Text block; نص لمحركات البحث · Text for Google; أسئلة شائعة · Common questions; فيديو · Video; مسافة فاصلة · Spacer (new) |

Legacy types ("قديم") disappear from the library; pages that still use them keep working.

## Phase 3 — No emoji anywhere
- Library cards: a drawn mini-preview of the section instead of an emoji.
- Storefront: trust badges, store perks, promo cards, buttons used emoji as icons → a curated line-icon
  picker (about 60 shop icons). Saved emoji are converted to the nearest icon automatically.

## Phase 4 — A better library window
- Mini picture of each section, one plain sentence of what the shopper sees, a "good for" hint.
- "Already on your page ×2" badge; warnings for one-per-page sections (main slideshow).
- Search understands Arabic and English words and common synonyms.
- "Recently added" row instead of the fixed "popular" row.

## Phase 5 — Better options and new types
- Product rows: pick by category / brand / on sale / new / best sellers / hand-picked, hide out of
  stock, number of items, show add-to-cart, phone and desktop columns.
- Slideshow: separate phone image, text position, speed, per-slide dates.
- Category icons: circle or square, size, choose which categories.
- Every section: hide itself when it has nothing to show (no empty boxes for shoppers).
- New types listed above (coupon, occasion tiles, bundle, next delivery slot, share & earn, spacer).

## Phase 6 — Check
Backend + frontend tests, then the real storefront and builder in the browser on phone and desktop
widths, Arabic and English.
