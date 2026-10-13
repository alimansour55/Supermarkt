# Marketplace (third-party sellers)

Outside sellers list and sell their products in the store, Amazon-style. Every product shows
**who sells it** and **who ships it**. The store collects all payments, keeps its commission
and pays sellers after a hold period.

## How it works, end to end

1. **Apply.** A seller fills in `/sell-with-us` (or staff add one in **Admin → Sellers**).
   They get a Seller Center login at `/seller-center` (email + password).
2. **Approve the seller.** Staff review the store details and the KYC documents (ID, commercial
   register, tax card) and approve, reject (with a reason) or later suspend.
3. **List products.** Sellers add products one by one or by CSV import. New listings wait in
   **Admin → Listing review**. On a live listing, price and stock change instantly; name,
   description, images and category wait for review while customers keep seeing the approved
   version. Trusted sellers can be set to publish without review.
4. **Sell.** A customer can mix store and seller products in one cart. Checkout creates one
   order (one payment) plus one **shipment** per seller and fulfillment mode.
5. **Fulfil.**
   - *Shipped by seller:* the seller confirms, packs, ships (carrier + tracking number) and
     marks delivered in Seller Center. Customers see each shipment on their order.
   - *Shipped by store:* the seller sends stock to the warehouse first (**Inbound stock**);
     the store's own staff and drivers deliver it with the store's lines.
6. **Get paid.** On delivery the seller's ledger is credited. After the hold period staff create
   a payout in **Admin → Seller payouts**, transfer the money (bank batch CSV) and mark it paid.

## Money rules

| Event | Seller ledger |
|---|---|
| Shipment delivered | + item value, + seller delivery fee, − commission, − store fulfillment fee |
| Seller collected cash itself (COD, seller ships) | − the cash collected |
| Item returned (refund approved) | − the returned line value, + its commission back |
| Manual adjustment | ± (e.g. seller paid commission in cash) |
| Payout marked paid | − the payout |

- **Commission**, the most specific rule wins: seller × category → seller rate → marketplace ×
  category → marketplace default (**Admin → Marketplace settings**). The rate is copied onto each
  order line, so later changes never rewrite past sales.
- **Discounts** (coupons, points) are paid for by the marketplace; sellers earn the full item value.
- **Hold period** (default 14 days) covers the return window before money becomes payable.
- **Cash on delivery:** each seller-shipped shipment records how much cash that seller collects;
  the store driver only sees and collects the store's share.
- A seller's balance can go **negative** (it collected cash but owes commission). Payouts are
  refused until it is settled with an adjustment.
- The ledger is append-only with idempotency keys — re-running a posting never pays twice.

## Cancellations and refunds

- A customer can cancel until any seller has shipped.
- A seller can cancel its own shipment (with a reason) before shipping. Its stock is restored and
  the customer is refunded for that part: unpaid cash orders simply owe less, wallet money goes
  back to the wallet, card payments are refunded through the gateway. Anything the system can't
  refund itself (e.g. InstaPay transfers) appears under **Seller shipments → Needs manual refund**.

## Visibility rules

- A seller product is shown to customers only while its listing is **approved** and its seller
  is **active** — enforced in the Product model, so no admin form or bulk action can bypass it.
- Suspending a seller hides all its products at once; reactivating brings back the approved ones.
- Sellers only ever see their own products, shipments and money. Customer name, phone and address
  are shown only for shipments the seller delivers itself, and only while the shipment is open.
- KYC documents are private Cloudinary assets, viewable through links that expire in 10 minutes.

## Categories: two kinds

- **Store sections** (`SellerCategory`) belong to one seller — "Honey", "Gift boxes"… Sellers
  create them freely (one nesting level, unique names, up to 200), assign products to them
  (applies instantly, no review) and customers filter the seller's store page by them
  (`/api/products?seller=…&sellerCategory=…`; a parent includes its sub-sections). Empty or
  hidden sections are not shown to customers.
- **Marketplace category** is the admin category tree used for site-wide browsing, search,
  SEO and category commissions. It is **optional** for sellers: they can leave it empty and
  type a suggestion (`categorySuggestion`). Staff pick or correct it in Listing review —
  a listing cannot be approved (or auto-published) without one, and a live listing keeps it.

## Where things are

| Who | Screen |
|---|---|
| Customers | `/sell-with-us`, `/sellers/:slug` (store page), "From marketplace sellers" filter, shipments + seller rating on the order page |
| Sellers | `/seller-center` — see **Seller Center layout** below |
| Staff | Admin → Marketplace: Sellers, Seller shipments, Listing review, Seller inbound stock, Seller payouts, Marketplace settings |

Permissions: `sellers:read` (view sellers and queues), `sellers:write` (approve, money moves);
seller shipments use `orders:*`, inbound stock uses `products:*`, payouts reading uses `reports:read`.

## Seller Center layout

A sidebar on the start side (right in Arabic) groups everything like Amazon Seller Central;
`frontend/src/seller/sellerNav.js` is the single menu definition (badges come from
`GET /api/seller/summary`). The top bar has quick search (`/` focuses it), notifications,
"Add product" and the account menu.

| Menu | Pages |
|---|---|
| Home | Dashboard: sales vs previous period, daily chart, top products, action centre, balance, account health, onboarding checklist (`GET /seller/home?days=7\|30\|90`) |
| Catalog | All products (bulk sections, duplicate, CSV import via `?import=1`), Add product, Manage inventory (spreadsheet edit, `PUT /seller/products/bulk-inventory`), My store sections |
| Orders | Manage orders (tabs, date/fulfillment filters, ship-by deadlines, bulk confirm/packed, CSV export), Send stock to us (store fulfillment only) |
| Payments | Balance & payouts, Payout details |
| Business reports | Sales by day / product / store section with CSV export (`GET /seller/reports/sales`) |
| Performance | Account health (cancel < 2.5 %, late ship < 4 %, rating ≥ 3.5), Customer feedback |
| Store settings | `/store`, `/store/documents`, `/store/payout`, `/store/team` |
| Notifications, Help center | Full notification list; fees, guides and FAQ |

## Seller Center tools (security, operations, growth)

- **Security**: forgot / reset password by email, change password, optional 2-step sign-in
  (emailed code), new-sign-in alert emails and sign-in history. Tokens carry a session
  version (`sv`); password change / reset, "sign out everywhere" and deactivating a staff
  login bump `User.sessionVersion`, which ends every other session.
- **Staff permissions** per area: `products`, `orders`, `reports`, `finance`, `store`
  (`SELLER_PERMISSIONS`; owners have all). Enforced by `sellerCan()` on the API and mirrored
  in the menu. **Activity log** (`SellerActivity`, owner-only, kept one year).
- **Returns** of the seller's items (read from `Order.returns`; staff still decide) with a
  seller note. **Shipping labels** (Code 128) + packing slips, printable in bulk.
- **Alerts** (`sellerAlerts.service.js`, run by `jobs/sellerJobs.js` every 5 min): new-order
  email/WhatsApp, ship-by reminders 6 h before the deadline, low-stock alerts with a
  per-product level. Preferences in `Seller.notificationPrefs`.
- **Payout statements** (printable + CSV). **Catalog export → Excel → import** updates
  existing products by `id` or `sku` (price, old price, stock, alert level, sections).
- **Product Q&A** (`ProductQuestion`, marketplace products only) and **seller replies to
  product reviews** (`adminReply.byRole = 'seller'`).
- **Vacation mode**: `Seller.vacation` + `Product.sellerAway` mirror hide every listing;
  ends automatically on the return date.
- **Seller promotions** (`SellerPromotion`): staff approve, the job applies them as price
  markdowns, prices are locked while running and restored from a snapshot afterwards; one
  promotion per product at a time.
- **Store page design** (`Seller.storefront`: tagline, banners, featured products) and
  **traffic** (`ProductStat`: daily views / add-to-cart per product, `POST /product-events`).
- E2E: `e2e/seller.spec.js` walks sign-in → section → product → approval → storefront →
  inventory → promotion in a real browser.

## Code map

- Models: `Seller`, `SellerCategory`, `MarketplaceSettings`, `Shipment`, `SellerLedgerEntry`, `SellerPayout`,
  `SellerReview`, `InboundShipment`; marketplace fields on `Product`, `Order` and `User`.
- Services: `marketplace.service.js` (settings, commission, seller status),
  `marketplaceOrder.service.js` (cart plan, shipments, status sync, cancellations),
  `sellerLedger.service.js` (ledger, payouts), `sellerReputation.service.js` (ratings, performance),
  `sellerCategory.service.js` (store sections).
- Routes: `/api/sellers` (public), `/api/seller` (portal, always scoped to the signed-in seller),
  `/api/admin/marketplace` (staff).
- Tests: `backend/test/marketplace.*.test.js` (onboarding, orders, finance, storefront, ops, catalog, insights, security, alerts, tools, growth).

## Local demo

```bash
npm run seed:demo-seller --prefix backend -- --approve-listings
```

Creates (or resets) an active demo seller and publishes its pending listings. The login is in
`backend/scripts/seed-demo-seller.js`.

## Not built yet

- **Several sellers offering the same product (Buy Box).** Today each product has exactly one
  seller. Supporting offers means separate price/stock per seller on one product page and an
  offer id in the cart — a large change to the core catalog, worth doing only when sellers start
  listing the same items.
- **Courier integrations** (Bosta, Aramex …) for automatic tracking numbers and labels — sellers
  type tracking numbers by hand for now.
- **Seller-funded coupons and promotions.**
