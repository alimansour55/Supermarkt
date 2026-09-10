# Storefront Redesign — HyperOne look-and-feel + performance parity

Goal: rebuild the **customer web storefront** (`D:\Project supermarket\frontend`, React 19 +
Vite 8 + Tailwind v4) so its layout, component anatomy, interaction patterns, motion and
perceived performance match **hyperone.com.eg** (Nuxt 3 / Vue storefront).

Scope: customer storefront only. `src/admin/**` and `src/pages/driver/**` are untouched
except for shared primitives.

## What "the same" means here

Match, 1:1 where practical:
- page layout & grid, section order, spacing rhythm, breakpoints
- component anatomy (header tiers, product card, filter rail, account shell, footer)
- the **design-token system** (colours, radii, typography, elevation) — values extracted
  from the live site are in Phase 0
- micro-interactions: hover, add-to-cart stepper, carousel controls, sticky behaviour
- loading strategy: skeletons, lazy sections, prefetch-on-intent, infinite scroll
- Lighthouse / Core Web Vitals targets

Stays ours (do **not** copy):
- brand name, logo mark, wordmark → keep `settings.logoUrl` / سوق+ / MarketPlus
- HyperOne's photography, banner artwork, marketing copy, category art
- their API — we keep our `/api` (Node/Express + Mongo) and CMS-driven homepage

Everything is driven by our existing data layer, contexts and routes in
[`src/App.jsx`](src/App.jsx). This is a re-skin + layout restructure, not a rewrite.

Legend: `[x]` done · `[~]` partial · `[ ]` todo

---

## Reference anatomy (from the live site)

**Global chrome — 3 stacked tiers + ETA strip:**
1. Utility bar — solid blue `#1d4ca1`, ~36px, tiny text. Start: `Deliver to: <area> ▾`.
   End: `Customer Service` · `Switch Language`.
2. Main header — white, ~72px. Start: rounded search field (full-width, grey fill,
   magnifier, ~43px tall, placeholder "What are you looking for?"). Center: wordmark.
   End: `Sign in / Register` (user icon) · wishlist heart · cart bag. All blue line icons.
3. Category bar — white, border-bottom, ~48px. Start: `▦ All Categories` (opens mega
   menu). Then ~6 top categories as plain blue links (weight 500, 14px). End: `Brands`,
   then `⊘ Deals` in red `#e22319`.
4. ETA strip — pale blue full-width, truck glyph, "Nearest delivery slot: between H – H".

**Home** (top → bottom):
- hero carousel — full-bleed with side padding, 16px radius, circular prev/next arrows
  half-outside the frame, dot indicators, autoplay
- promo tri-tiles — 3-up row of rounded banner cards (stack on mobile)
- "Hyperone Offers!" block — title + `View All`; horizontal chip filter
  (`All`, `Save More`, then category names); horizontal product carousel below it
- more merchandised product rails (same carousel pattern)
- "Shop by Category" — grid of rounded image tiles + label
- (brand strip pattern where used)

**Category / listing page** (`/c/<slug>`):
- breadcrumb `Home / Electronics`
- big bold H1
- subcategory pills — horizontal scroll, `All` + children, pill-selected state
- optional full-width promo banner
- body = left **Filters** rail (~260–280px: price range slider, Brand, then spec facets
  as collapsible groups) + right column
- right column header: `<N> Products` count · `Sort By: Most Popular ▾`
- responsive product grid (2 / 3 / 4 / 5 cols by breakpoint)
- **infinite scroll** (IntersectionObserver), not numbered pages

**Product card** (radius 16px, white, hairline border):
- discount badge top-start — pill, `-33%` (their sign is a leading minus, red/orange)
- quantity chip / stepper (starts at `0`, `+` to add — the stepper *is* the CTA)
- square `object-contain` image on white, generous padding
- rating `(0/5)` line where present
- 2-line product name, small, muted-ink
- price: large bold near-black + struck-through old price
- wishlist heart on hover

**Footer** — solid blue `#1d4ca1`, white text:
- social row (LinkedIn, TikTok, Facebook, Instagram, YouTube)
- short brand line + tagline + `GO TO TOP`
- link columns: `Customer Support` (FAQs, Contact Us) · `About HyperOne` (About Us) ·
  `Download Mobile App` (App Store, Google Play)
- bottom: `©<year> …` + `Terms and Conditions` · `Privacy Policy` · `Return Policy`

**Account area** (`/account/*`, auth-gated): left vertical nav + right content pane
(Overview, Orders, Addresses, Wallet/Points, Profile, …). We can't see it logged-out;
build to the standard sidebar-shell pattern.

**Performance model:** SSR HTML + hydration, per-component JS/CSS chunks, lazy chunks for
below-the-fold widgets, image CDN with width/format negotiation, IntersectionObserver for
lists and rails.

---

## Phase 0 — design-token foundation  ← DONE (build clean, verified in browser)

- [x] **Colour tokens** — [`src/index.css`](src/index.css) `@theme` rewritten. Our scale
  keeps `600` as the CTA anchor, so HyperOne's `#1d4ca1` maps to `--color-primary-600`
  and the ramp is anchored on it (`50 #f2f6fb … 900 #0b1a36`). Added semantic
  `--color-danger-*` (`500 #e22319`), `--color-success-*` (`500 #4e9700`),
  `--color-warning-*` (`500 #ff8d38`); accent retuned to promo orange `#ff8d38`.
  Neutrals: `--color-text #0b1a36`, `--color-text-muted #6f6f6f`,
  `--color-border #d2d5dc`, `--color-surface #f6f7f9`, `--color-surface-alt #f7f7f7`.
- [x] **Runtime theme** — the storefront palette is driven by the admin setting
  `settings.themeColor` (per user: keep the picker working, just switch this store).
  Frontend: added a `hyperone` theme to
  [`src/constants/siteThemes.js`](src/constants/siteThemes.js), set as
  `DEFAULT_THEME_COLOR`. **Backend** (the settings GET handler resets any unknown
  `themeColor` back to the default and re-saves — so the frontend change alone is not
  enough): added `hyperone` to `backend/src/constants/siteThemes.js` `SITE_THEME_KEYS`,
  bumped `DEFAULT_THEME_COLOR` there + in `storeDefaults.js`, `StoreSettings` model
  default →`hyperone`. Live store doc set with
  `StoreSettings.updateOne({key:'main'},{themeColor:'hyperone',themeShade:600,siteFont:'cairo'})`
  (also switched the store font from `ibm-plex-sans-arabic` → `cairo` to match HyperOne).
  Verified: API serves `themeColor:hyperone`, `data-site-theme="hyperone"`,
  `--color-primary-600:#1d4ca1`, header/nav/buttons render blue and persist across reload.
  Helper left at `backend/src/scripts/setStoreTheme.js`.
- [x] **Typography** — stack extended to
  `'Cairo','Ubuntu','Open Sans',system-ui,…`. Still loaded from Google Fonts (existing
  `<link>` + preconnect). **TODO (moved to Phase 8):** self-host Cairo woff2 +
  `font-display:swap` + preload the 2 critical weights.
- [x] **Radii** — `--radius-field:12px` (`rounded-field`), `--radius-tile:14px`,
  `--radius-card:16px` (`rounded-card`). Pill = `rounded-full`.
- [x] **Elevation** — `--shadow-card`, `--shadow-pop`, `--shadow-menu` (→ `shadow-card`
  etc.).
- [x] **Container** — `.container-app` is now fluid
  (`w-full px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-12`, no max-width). Added
  `.container-readable` (`max-w-3xl`) for auth / static / form pages — **apply it to
  those pages in later phases** (they currently rely on inner `max-w-*`).
- [x] Class names kept semantic so later phases are markup-only.
- [x] **Primitives** — `Button` (pill `rounded-full`, `danger`→`bg-danger-500`,
  `secondary`→outlined blue), `Input` + `Textarea` (`rounded-field`, `border-border`,
  `border-danger-300` / `text-danger-600` errors). Verified in `npm run build`.
- [~] `theme-rotating` transition block in `index.css` — **kept** (admin picker still
  works per the decision above); revisit only if it shows in the storefront perf trace.
- [ ] **Still to do:** `Loader` / `Skeleton` / toast colour pass; `ProductImage` (Phase 2
  + Phase 8); self-host Cairo (Phase 8); per-route screenshot set as each phase lands.

---

## Phase 1 — global chrome

[`src/components/layout/Header.jsx`](src/components/layout/Header.jsx),
[`NavMenu.jsx`](src/components/layout/NavMenu.jsx),
[`HeaderToolbar.jsx`](src/components/layout/HeaderToolbar.jsx),
[`Footer.jsx`](src/components/layout/Footer.jsx),
[`Layout.jsx`](src/components/layout/Layout.jsx).

- [x] **Desktop header → 3 tiers** matching the anatomy above:
  - [x] Tier 1 utility bar: `bg-primary-800 text-white`, `LocationSelector` as
    `Deliver to: <area> ▾` on the start side; `Customer Service` link (`/contact`) +
    language toggle on the end.
  - [x] Tier 2: `grid-cols-[1fr_auto_1fr]` — search field (soft **pill** variant,
    `rounded-full bg-primary-50`, inline magnifier, no submit button; placeholder
    "What are you looking for?") on the start; wordmark dead-centre with `px-10`
    breathing room; account/wishlist/cart on the end as blue line icons
    (`strokeWidth 1.75`) with `bg-danger-500` count badges. Wishlist → `/favorites`,
    cart → `/cart` (drawer wiring deferred).
  - [x] Tier 3 (`NavMenu`): every item — `▦ All Categories` (opens `CategoryMegaMenuPanel`
    scope `all`), the category links, and `Offers/Deals` — is a plain text link sharing
    one `NAV_BASE` padding (`px-4 lg:px-[22px]`), so spacing is uniform across the bar.
    `Offers` is red text + tag icon, inline as the last item (no `ms-auto`). Active/open
    gets a 3px underline. Hover-intent + prefetch kept. Mega panels are container-width,
    `rounded-b-2xl`, flush to the bar.
- [x] **ETA strip** — new [`DeliverySlotStrip.jsx`](src/components/layout/DeliverySlotStrip.jsx)
  under the sticky header: pale-blue full-width, truck icon, "Nearest delivery slot: …"
  from `location` context (falls back to announcement, then hides when nothing to show).
  Still to fold in: retire `HomeDeliveryBar` / `HomeFreeDeliveryBanner` duplication.
- [x] **Sticky behaviour**: `<header>` (tiers 2+3) is `sticky top-0`; tier 1 + ETA strip
  are siblings outside it and scroll away.
- [~] **Mobile header** — row 1 = menu · wordmark · location (cart lives in
  `BottomTabBar`); row 2 = full-width search. `MobileMenu` restyle to blue + BottomTabBar
  active-state pass still TODO.
- [ ] **Footer** → `bg-primary-800 text-white`; social row on top; 3 link columns
  (Customer Support / About / Download App) sourced from
  `settings.navigation.footerColumns` with the fallback rewritten to match; `GO TO TOP`
  button; bottom legal row (`Terms` · `Privacy` · `Return Policy`). Drop the dark-slate
  styling and the 5-col contact grid; keep `FooterShopDirectory` above it, restyled.
- [ ] Mega-menu panels ([`CategoryMegaMenuPanel`](src/components/layout/CategoryMegaMenuPanel.jsx),
  [`OffersMegaMenuPanel`](src/components/layout/OffersMegaMenuPanel.jsx)): white,
  `shadow-menu`, blue headings, 16px radius, tighter rows.
- [ ] `LocationSelector` / `DeliveryAreaPicker`: modal styled like the site's
  "Select Your Location" (City / Region / District selects + "Set Location on Map").

---

## Phase 2 — product card + grid + rails

[`src/components/product/ProductCard.jsx`](src/components/product/ProductCard.jsx),
[`ProductGrid.jsx`](src/components/product/ProductGrid.jsx),
[`ProductGridSkeleton.jsx`](src/components/product/ProductGridSkeleton.jsx),
[`src/components/home/ProductSection.jsx`](src/components/home/ProductSection.jsx).

- [ ] Rebuild `ProductCard` to the reference anatomy:
  - card = `rounded-[16px] border border-[#d2d5dc] bg-white` (bring back the outer card;
    current design deliberately has none), `shadow-card` → `shadow-pop` on hover
  - discount badge top-**start**, pill, `-<n>%` style, `bg-danger-500 text-white`
    (or warning-orange for "save more")
  - image: square-ish, `object-contain`, `p-4`, white; subtle zoom on hover
  - name: 2 lines, `text-[13px]`, muted ink, below image
  - price row: current price `text-[20px] font-extrabold` ink; old price struck,
    `text-[#6f6f6f]`; keep EGP label
  - rating line `(x/5)` when `reviewCount` — small, under name
  - the **stepper is the CTA**: `0 → +`; once in cart show `–  n  +` chip; keep the
    existing `card-cart-control` animation but restyle to blue pill
  - wishlist heart top-end, appears on hover (desktop), always visible (mobile)
  - keep `prefetchProduct` on hover/focus/touch
  - RTL: badge flips to top-end, text realigns — keep the current dir handling
- [ ] `productGridDelegate` equivalent for web: fixed card height per breakpoint to kill
  CLS; grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4`.
- [ ] Rail/carousel component (used by home + "similar products" + offers): horizontal
  scroll-snap, circular arrow controls that overflow the frame, no arrows on mobile,
  `scrollbar-thin` hidden.
- [ ] Skeleton matches the new card exactly (same height/rounding).

---

## Phase 3 — home page

[`src/pages/HomePage.jsx`](src/pages/HomePage.jsx) +
`src/components/home/**` + [`HomepageSectionRenderer.jsx`](src/components/home/HomepageSectionRenderer.jsx).

- [ ] **HeroSlider**: full-bleed w/ side padding, `rounded-[16px]`, circular prev/next
  half outside the frame, dot indicators, autoplay + pause-on-hover, lazy non-first
  slides, `fetchpriority=high` + preload on slide 1 (LCP).
- [ ] **Promo tri-tiles** — restyle `PromoBanners` / `HomepagePromoGrid` to the 3-up
  rounded-card row; 1-up stack on mobile.
- [ ] **Offers block** — new `OffersRail.jsx`: section title + `View All`; category chip
  filter row (`All`, `Save More`, then categories from `useCategories`); product carousel
  bound to `/products/offers` filtered by the active chip. Reuse Phase 2 rail.
- [ ] Merchandised rails (Best Sellers, New Arrivals, Today's Deals) → same rail pattern,
  consistent section header (`icon + title` start, `View All` end).
- [ ] **Shop by Category** — restyle `HomeBrowseHub` / `CategoriesScroll` to a grid of
  rounded image tiles + centered label; link to `/c/<slug>`.
- [ ] `TodaysDealsSection` + `DealCountdown`: keep countdown, restyle chip to danger-red.
- [ ] `BrandRow`: restyle to a clean logo strip.
- [ ] Section vertical rhythm: `py-6 md:py-10`, alt sections on `#f7f7f7`.
- [ ] Keep CMS-driven ordering; every `HomepageBlocks` type gets a restyle pass:
  `HomepageSplitPromo`, `HomepagePromoGrid`, `ImageStripSection`, `HomepageCtaSection`,
  `HomepageLoyaltyPromo`, `HomepageRecurringPromo`, `HomepageAppDownload`,
  `HomepageSidebarBanners`, `HomepageAnnouncementStrip`.
- [ ] Below-the-fold sections: lazy-mount via IntersectionObserver wrapper +
  `content-visibility:auto` on section wrappers.

---

## Phase 4 — category / listing page

[`src/pages/ProductListingPage.jsx`](src/pages/ProductListingPage.jsx),
[`CategoryBrowsePage.jsx`](src/pages/CategoryBrowsePage.jsx),
[`CategoryPage.jsx`](src/pages/CategoryPage.jsx),
[`src/components/product/ProductFilters.jsx`](src/components/product/ProductFilters.jsx).

- [ ] Page head: breadcrumb (`Home / <Category>`), big bold H1, then a horizontal
  **subcategory pill strip** (`All` + children, selected = filled blue pill,
  scroll-snap). Move the inline `<SearchBar>` out of the listing head (search lives in
  the header now).
- [ ] Optional category promo banner slot (from CMS/category data) under the strip.
- [ ] Layout `grid lg:grid-cols-[264px_1fr] gap-6`:
  - **Filters rail**: `price` range slider first, then `Brand`, then spec facets as
    collapsible groups; "clear all"; sticky within viewport; mobile = full-screen sheet
    triggered by a `Filters` button with active-count badge.
  - Right column top bar: `<N> Products` (start) · `Sort By <current> ▾` (end),
    on one line, hairline divider under it.
  - `ActiveFilterChips` row below the bar.
- [ ] **Switch pagination model to infinite scroll**: replace `ProductPagination` with an
  IntersectionObserver sentinel that appends the next page; keep scroll position; show a
  small spinner row; preserve `?page` in URL for shareability + restore on back.
  (Numbered pagination stays available behind a prop for the Flutter webview if needed.)
- [ ] Grid = Phase 2 grid. Empty state restyled.
- [ ] `SubCategoryProductsPage` / `MainCategoryPage` fold into this shell.

---

## Phase 5 — product detail page

[`src/pages/ProductDetailsPage.jsx`](src/pages/ProductDetailsPage.jsx),
`src/components/product/ProductVariantPicker.jsx`, `ProductReviewsSection.jsx`.

- [ ] 2-column: gallery (start, sticky, thumb rail + main `object-contain` on white,
  zoom) / buy-box (end): name, rating summary, price block (current big + old struck +
  `-n%` pill + "you save"), variant picker, quantity stepper, primary
  `Add to cart` (filled blue pill) + wishlist, delivery-slot / zone note, stock state.
- [ ] Info tabs / stacked sections: Description, Specifications table, Reviews.
- [ ] "Similar products" + "Frequently bought" rails (Phase 2 rail).
- [ ] Breadcrumb; sticky mini add-to-cart bar on scroll (mobile).
- [ ] Skeleton for the whole PDP.

---

## Phase 6 — cart, drawer, checkout

[`src/pages/CartPage.jsx`](src/pages/CartPage.jsx),
[`CheckoutPage.jsx`](src/pages/CheckoutPage.jsx), cart drawer,
`src/components/checkout/**`, `src/components/order/**`.

- [ ] **Cart drawer** (slide-in from end): line items with stepper, image, price;
  subtotal; free-delivery progress bar; `min order` notice; `Proceed to Checkout` pinned.
  Mirror the site's `CartItem` / `CartMinimumAmount` / `CartProceedToCheckout` structure.
- [ ] **Cart page**: 2-col (items / summary card sticky on end). Summary = subtotal,
  delivery, points, coupon field, total, CTA.
- [ ] **Checkout**: single scrollable page with numbered/step cards — Address (saved
  selector + map pin), Delivery method + day/slot, Payment (COD / card / manual transfer),
  Points, Coupon — with a sticky `PaymentSummary` on the end. Match the site's
  `PaymentSummary` / `UnavailableProductsReplacements` blocks.
- [ ] All fields → Phase 0 primitives (12px radius, blue focus, `#001f58` text).

---

## Phase 7 — account area + auth

[`src/pages/ProfilePage.jsx`](src/pages/ProfilePage.jsx), `MyOrdersPage`,
`OrderDetailPage`, `MyAddressesPage`, `MyPointsPage`, `AccountSettingsPage`,
`RecurringDeliveriesPage`, `FavoritesPage`; `LoginPage`, `RegisterPage`.

- [ ] **Account shell** `AccountLayout.jsx`: left vertical nav (Overview, Orders,
  Addresses, Wallet/Points, Recurring, Wishlist, Profile, Logout) + right content pane;
  collapses to a top tab/scroller on mobile. Route `/account` → Overview with summary
  cards (orders count, points balance, active subs, default address). Wire the existing
  pages into the shell as children (keep their routes as aliases).
- [ ] Order cards / order detail: status timeline, restyled to blue; keep all Phase-4
  Flutter-parity features (tracking, chat, returns, invoice).
- [ ] Auth pages: centered card, wordmark, phone + OTP flow, blue CTA, minimal chrome.
- [ ] `AccountMenu` header dropdown matches the account nav.

---

## Phase 8 — search + misc pages + performance parity

**Search** — [`src/components/search/SearchBar.jsx`](src/components/search/SearchBar.jsx),
`SearchPage`, `SearchResultsPage`:
- [ ] Header search opens a full-width suggestions panel: recent (clearable), trending,
  live product + category rows (debounced `/search/suggestions`), keyboard nav.
- [ ] Results page = Phase 4 listing shell with `q`.

**Misc**: `StaticPage` (about/faq/terms/privacy/returns/careers), `NotFoundPage`,
`TrackOrderPage`, `OffersPage`, `TodaysDealsPage`, payment result pages — restyle to
tokens, consistent page header, blue CTAs.

**Performance parity** (target: mobile Lighthouse Perf ≥ 90, LCP < 2.5s on 4G,
CLS < 0.1, TBT < 200ms, INP < 200ms):
- [ ] **Route-level code splitting** already via `lazyRoutes` — audit
  [`vite.config.js`](vite.config.js) `manualChunks`; ensure home + card + header are in
  the entry chunk and nothing else large is.
- [ ] **Component-level lazy** for below-the-fold home sections, mega-menu panels, cart
  drawer, map pickers, Stripe, charts, reviews — `React.lazy` + IntersectionObserver.
- [ ] **Image pipeline**: `ProductImage` / banner images → responsive `srcset` + `sizes`,
  `loading="lazy"` (except LCP), `decoding="async"`, explicit `width`/`height` or aspect
  box, AVIF/WebP with fallback. If the API/CDN can resize, request exact widths; else add
  a thin image-proxy. Preload the hero LCP image.
- [ ] **Fonts**: self-host Cairo woff2, `font-display:swap`, `<link rel=preload>` for the
  2 critical weights, subset to Latin+Arabic.
- [ ] **CLS**: fixed card heights, reserved space for hero / banners / ETA strip / rails,
  no layout-shifting skeleton→content swaps.
- [ ] **Prefetch on intent**: keep `prefetchProduct` / mega-menu prefetch; add
  `prefetch` of the next listing page and of route chunks on nav-link hover.
- [ ] **HTTP caching**: hashed assets `immutable`; `stale-while-revalidate` for catalog
  GETs; dedupe in-flight requests (already partly in `productApi`).
- [ ] **`index.html`**: preconnect to API + image host, inline critical CSS for the
  header/hero, defer the rest.
- [ ] **SSR/prerender decision** — the reference is SSR. Options, pick one:
  - keep SPA + aggressive prefetch + skeletons (least work), or
  - add prerendering for home + top category + PDP via `vite-plugin-ssr`/`vike` or a
    static prerender step (best FCP/SEO, matches the site). Record the decision here.
- [ ] Remove render-blocking: Google Maps JS loads only on checkout/address routes.
- [ ] Lighthouse CI budget file + a `npm run perf` script; record before/after numbers.

---

## Phase 9 — RTL, a11y, cross-browser, QA

- [ ] RTL sweep: every new component tested in Arabic (default) — badges, steppers,
  carousels arrows, breadcrumbs, filter rail side, account nav side.
- [ ] a11y: focus-visible rings on all interactive elements, `aria` on steppers /
  carousels / menus, colour-contrast AA against the new blue, skip-to-content,
  reduced-motion for carousels/animations.
- [ ] Keyboard: mega menu, search suggestions, filter groups, drawer.
- [ ] Browser matrix: Chrome, Safari (iOS), Firefox, Samsung Internet.
- [ ] Visual-regression pass vs Phase-0 baselines; sign-off screenshot set per route.
- [ ] Verify Flutter app's webview surfaces (if any) still render.

---

## Acceptance criteria

- Side-by-side: our home / category / PDP / cart / account read as the same product as
  hyperone.com.eg in layout, spacing, colour system and interaction — with our branding.
- All existing routes, CMS sections, checkout, loyalty, returns, tracking still work.
- Mobile Lighthouse: Perf ≥ 90, A11y ≥ 95, Best-Practices ≥ 95, SEO ≥ 95.
- CWV field-style lab: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- No regression in `npm run build` size budget (entry chunk ≤ ~180KB gzip).
- AR (RTL) and EN both clean.

## Suggested order & rough size

Phase 0 (foundation, blocks everything) → 1 (chrome) → 2 (card) → 3 (home) →
4 (listing) → 5 (PDP) → 6 (cart/checkout) → 7 (account) → 8 (search + perf) →
9 (QA). Phases 2–8 are largely parallelizable once 0–1 land.
