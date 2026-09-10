# المحفظة (Store Wallet) — build plan & task tracker

A real-money **store credit balance** (in EGP) attached to every customer account.

* **Customers** top it up by bank transfer (**InstaPay**) or **Vodafone Cash** — same
  "transfer + upload proof" flow already used for manual-payment orders — and an
  admin approves the top-up. They spend the balance at checkout like cash.
* **Admins** credit a wallet directly for refunds, goodwill, compensation or
  promo credit, and can debit / correct a balance with a documented reason.
* On a full order cancel/refund, any wallet money that was spent on that order is
  returned to the wallet automatically.

Legend: `[x]` done · `[~]` partial · `[ ]` todo

---

## A. Backend (`D:\Project supermarket\backend`)

### A1 — Data model
- [x] `models/WalletTransaction.js` — ledger: `user`, `type`
      (`topup|spend|refund|adjust|reversal`), signed `amount`, `balanceAfter`,
      `order`, `topUpRequest`, `method`, `note`, `createdBy`, timestamps
- [x] `models/WalletTopUpRequest.js` — `user`, `amount`, `method`
      (`instapay|vodafone_cash`), `senderReference`, `destinationAccount`,
      `proofUrl/publicId/uploadedAt`, `status` (`pending|approved|rejected`),
      `reviewedBy/reviewedAt/adminNote`, `walletTransaction`
- [x] `models/User.js` — add `walletBalance` (Number, min 0, default 0)
- [x] `models/Order.js` — add `walletAmount` (Number, min 0, default 0)
- [x] `models/StoreSettings.js` — add `wallet` sub-schema (enabled, allowTopUp,
      allowCheckoutSpend, minTopUp, maxTopUp, maxBalance, maxCheckoutPercent)
- [x] `models/index.js` — register the two new models
- [x] `constants/storeDefaults.js` — `DEFAULT_WALLET`

### A2 — Service
- [x] `services/wallet.service.js`
  - `DEFAULT_WALLET`, `normalizeWalletSettings`, `getWalletSettings`
  - `creditWallet` / `debitWallet` (atomic, writes a `WalletTransaction`)
  - `calculateWalletRedemption` ({ requestedAmount, user, payableTotal, settings })
  - `reverseOrderWallet(order)` — refund wallet money spent on an order
  - `buildWalletSummary` (bilingual copy for the storefront)

### A3 — Checkout integration
- [x] `utils/cartCalculations.js` — accept `walletToSpend`, return `walletApplied`
      (applied after coupon + points, capped by balance / % / remaining total)
- [x] `controllers/order.controller.js` `createOrder` — read `walletToRedeem`,
      debit wallet atomically after the order row exists, roll back on failure,
      persist `order.walletAmount`; expose in the response + `calculateTotals`
- [x] `controllers/payment.controller.js` — Stripe line-item builder counts
      `walletAmount` toward the "totals don't match" single-line path
- [x] `services/orderManagement.service.js` + `controllers/orderManagement.controller.js`
      — `reverseOrderWallet` on full cancel / full refund

### A4 — Routes & controllers
- [x] `controllers/wallet.controller.js` — customer: `getMyWallet`, `createTopUp`,
      `getTopUp`
- [x] `controllers/walletAdmin.controller.js` — `overview`, `getSettings`,
      `updateSettings`, `listTopUps`, `approveTopUp`, `rejectTopUp`,
      `searchUsers`, `getUserWallet`, `adjustUserWallet`
- [x] `routes/wallet.routes.js` (`protect`; admin actions `requirePermission('settings:write')`)
- [x] `routes/index.js` — mount `/wallet`
- [x] `controllers/storeSettings.controller.js` — expose `wallet` in public settings

### A5 — Notifications (best-effort, try/catch)
- [x] top-up approved / rejected → `createUserNotification`

---

## B. Web frontend (`D:\Project supermarket\frontend`)

- [x] `services/apiServices.js` — `walletService` (getMe, createTopUp, getTopUp)
- [x] `admin/adminApi.js` — wallet admin calls
- [x] `utils/walletHelpers.js` — shared clamp / format helpers
- [x] `components/account/WalletPanel.jsx` — balance card, how-it-works, history
- [x] `components/account/WalletTopUpDialog.jsx` — amount → method → account → proof
- [x] `pages/MyWalletPage.jsx` + route `/my-wallet` (`lazyRoutes`, `App.jsx`)
- [x] `components/account/AccountSidebar.jsx` — "المحفظة" nav item
- [x] `components/checkout/CheckoutWalletApply.jsx` + wire into `CheckoutPage.jsx`
      and `CheckoutSidebarSummary.jsx`
- [x] `admin/pages/WalletPage.jsx` — overview, settings, top-up queue, customer
      lookup + adjust
- [x] `admin/adminNavGroups.js` (Customers group), `adminRouteMeta.js`,
      `app/lazyAdminRoutes.js`, `app/AdminRoutes.jsx`
- [x] `pages/ProfilePage.jsx` — wallet balance quick tile

---

## C. Flutter app (`D:\flutter projects\flutter_application_1`) — iOS + Android

- [x] `models/models.dart` — `WalletInfo`, `WalletTxn`, `WalletTopUp`
- [x] `services/market_api.dart` — `getWallet`, `createWalletTopUp`, `getWalletTopUp`
- [x] `screens/account/wallet_screen.dart` — balance, history, top-up sheet
      (amount / method / account / `image_picker` proof)
- [x] `router/app_router.dart` — `/my-wallet` route + auth guard
- [x] `screens/account/account_screens.dart` — wallet tile in the account menu
- [x] `screens/checkout/checkout_screen.dart` — wallet apply field →
      `walletToRedeem` in `/orders/calculate` + order create
- [x] `l10n/translations.dart` — wallet strings (AR/EN)
- [x] no native iOS/Android config needed (pure Dart + HTTP; proof upload reuses
      the `image_picker` already wired for manual-transfer orders)

---

## D. Verification
- [x] `node --check` + full `app.js` import on every changed/new backend file
- [x] service-level integration test vs live Mongo (credit/debit/clamp/reverse/
      over-debit guard/top-up-approve) — 10/10 pass
- [x] HTTP endpoint test vs running server (`/wallet/me`, `/wallet/admin/*`,
      permission 403, adjust, over-debit 400, top-up min 400) — 10/10 pass
- [x] public `/store-settings` now exposes `wallet` defaults
- [x] `npm run build` (frontend) passes
- [x] `flutter analyze` clean (0 errors / 0 warnings; only pre-existing infos)
- [x] `flutter build apk --debug`
- [ ] Manual QA with live backend (customer top-up → admin approve → checkout spend
      → refund reversal) — needs Cloudinary configured for the proof upload step

## Notes
- Top-up destination accounts reuse the existing `storeSettings.paymentMethods`
  entries for `instapay` / `vodafone_cash` — configure them under
  **Admin → Payment methods** (number + label) and they appear in the wallet
  top-up flow automatically.
- Admin wallet management lives at **Admin → Customers → Wallets**
  (`/admin/wallet`), permission `settings:write`.
- `AuditLog` action/entityType enums were widened to record wallet events
  (also fixes the previously-silent `action:'refund'` order-refund audit).
