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

## Where things are

| Who | Screen |
|---|---|
| Customers | `/sell-with-us`, `/sellers/:slug` (store page), "From marketplace sellers" filter, shipments + seller rating on the order page |
| Sellers | `/seller-center` — Dashboard, Orders, Products (incl. CSV import), Inbound stock, Earnings & payouts, Ratings, Store profile (documents, bank details, team) |
| Staff | Admin → Marketplace: Sellers, Seller shipments, Listing review, Seller inbound stock, Seller payouts, Marketplace settings |

Permissions: `sellers:read` (view sellers and queues), `sellers:write` (approve, money moves);
seller shipments use `orders:*`, inbound stock uses `products:*`, payouts reading uses `reports:read`.

## Code map

- Models: `Seller`, `MarketplaceSettings`, `Shipment`, `SellerLedgerEntry`, `SellerPayout`,
  `SellerReview`, `InboundShipment`; marketplace fields on `Product`, `Order` and `User`.
- Services: `marketplace.service.js` (settings, commission, seller status),
  `marketplaceOrder.service.js` (cart plan, shipments, status sync, cancellations),
  `sellerLedger.service.js` (ledger, payouts), `sellerReputation.service.js` (ratings, performance).
- Routes: `/api/sellers` (public), `/api/seller` (portal, always scoped to the signed-in seller),
  `/api/admin/marketplace` (staff).
- Tests: `backend/test/marketplace.*.test.js` (onboarding, orders, finance, storefront, ops).

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
