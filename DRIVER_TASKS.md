# المندوب (Driver App) — improvement plan & task tracker

Goal: take the driver experience from "works on the happy path" to a reliable,
auditable delivery operation, so that customers, admins and drivers all see the
same truth at the same time.

Legend: `[x]` done · `[~]` partial · `[ ]` todo

---

## 0. Current state (audit summary)

**What already exists:** driver login, active and history lists, a delivery
detail page (stepper, map, call and WhatsApp, Google Maps and Waze links,
picking checklist, cash calculator), complete with an optional photo, fail with
a reason, online/offline toggle, least-busy auto-assign, a live customer and
admin map (OSRM route cache, ETA), a wake lock, and SMS and notification hooks.

**Problems found while reading the code**, ordered by impact:

| # | Problem | Where |
|---|---------|-------|
| 1 | GPS runs **only while the delivery page is open**. Navigating back to the list, opening Waze, or locking the screen stops it. A driver carrying 3 orders streams location for **one** of them at most. | `frontend/src/hooks/useDriverGeolocation.js`, `DriverDeliveryPage.jsx` |
| 2 | `ensureOrderTracking` seeds the driver pin at the **store location with a fresh `updatedAt`**, so the customer sees a "live" driver who has not moved yet. | `backend/src/services/deliveryTracking.service.js` |
| 3 | Every location ping does `order.save()`, `ensureOrderTracking`, 3 `populate`s, and `buildTrackingSnapshot`, which may call OSRM and also writes to `Order`. That is heavy and will not scale. | `driver.controller.js → updateDriverOrderLocation` |
| 4 | "Arrived" and the picking checklist are stored **only in localStorage**. Admin and customer never see them, and the tracking status `arrived` is never sent to the server. | `DriverDeliveryPage.jsx` (`useLocalStorage`) |
| 5 | Complete is **not atomic**. A double tap or network retry can run `finalizeDriverOrderStatus` twice, which means double loyalty points and double SMS/email. The proof photo is uploaded to Cloudinary **before** the status check, so failed attempts leave orphan files. | `driver.controller.js` |
| 6 | The complete/fail responses call `formatDriverOrder(refreshed)` **without flags**, so store settings (GPS, checklist, cash calculator) are ignored in the response. | `driver.controller.js` |
| 7 | Admin "assign driver" jumps the order straight from `pending`/`confirmed` to `out_for_delivery`, skipping preparation and pickup. **The driver gets no notification**; only the customer does. | `orderManagement.controller.js → assignDriver` |
| 8 | COD orders are auto-marked `paid` on delivery with **no record of the cash collected**. There is no cash reconciliation per driver or shift. | `finalizeDriverOrderStatus` |
| 9 | `delivery_failed` is a dead end: no reattempt, no "return items to store" step, and no record of call attempts. | — |
| 10 | No proof that the driver was actually at the door: no customer OTP and no geofence check. | — |
| 11 | Home-pickup returns (`RETURN_METHODS.home_pickup`) promise "a driver will collect", but the driver app has no pickup tasks. | `constants/returnPickup.js` |
| 12 | No automated tests anywhere in the backend. | — |

---

## Phase 1: Fix correctness (do first, small and safe)

### 1.1 Atomic, idempotent status changes
- [x] Replace load → check → save in `finalizeDriverOrderStatus` with
      `Order.findOneAndUpdate({ _id, assignedDriver, orderStatus: 'out_for_delivery' }, …)`.
      If no document matches, return the current state (idempotent) instead of re-running side effects.
- [x] Run loyalty, email, SMS and the review request **only** when the atomic update actually changed the status.
- [x] Upload the proof photo **after** the ownership and status check. Delete it from Cloudinary if finalizing fails.
- [x] Pass `getDriverOrderFlags()` to `formatDriverOrder` in the complete and fail responses.
- [x] Frontend: action buttons are disabled while a request is in flight, "already delivered" returns success,
      and a `409` conflict reloads the order.

### 1.2 Honest tracking state
- [x] `ensureOrderTracking`: create the record with `status: 'idle'` and `lat/lng: null`, with **no fake store pin**.
      The customer sees "preparing / waiting for the driver" until the first real GPS fix.
      A reassignment or reattempt starts a fresh run, so the previous driver's position never leaks.
- [x] `updateDriverOrderLocation`: drop `order.save()` and the snapshot build. Write to `DeliveryTracking` only.
      Compute route and ETA when the snapshot is **read** (it is already cached).
- [x] Fire the "first location" and "ETA alert" SMS from a cheap check on the tracking flags, not from a full snapshot.

### 1.3 Assignment hygiene
- [~] `assignDriver` must not skip states. Assigning a driver to a `pending`/`confirmed`/`preparing` order keeps
      the status. The order moves to `out_for_delivery` when the driver confirms **pickup** (Phase 2.1).
      Keep a store setting `assignMovesToOutForDelivery` for backward compatibility (default `false`).
      *Done so far:* setting `driverSettings.assignDispatchesOrder` (admin → Delivery settings). It defaults to
      `true` (old behaviour) until the pickup step exists, because the driver cannot dispatch an order yet.
      When it is off, assigned orders show in the driver app as **Upcoming**. The jump to out-for-delivery is
      now recorded in the status history.
- [x] Notify the **driver** on assign, reassign and unassign (in-app notification now, push in Phase 3).
      There is a bell in the driver header, plus a toast and vibration on a new assignment, and the list auto-refreshes.
- [x] On reassign or unassign, close the old `DeliveryTracking` record for the previous driver.

### 1.4 Bugs found and fixed while doing Phase 1
- [x] Driver audit entries were **never saved**: `driver_complete_delivery`, `driver_fail_delivery` and
      `update_tracking` were missing from the `AuditLog.action` enum (the error was swallowed).
- [x] Every tracking SMS (driver on the way, driver nearby, tracking link) printed **"undefined"** instead of
      the order number: `sendTrackingSms` spread a Mongoose document.
- [x] The delivery map painted **over** the complete and fail dialogs (Leaflet z-index). The map is now `isolate`.
- [x] The same enum gap dropped audit entries for `cancel`, `return_request` and `return_fulfillment` (fixed in 2.5).
- [ ] Not driver scope: audit entity types `staff_account`, `support_conversation`, `chat_agent`,
      `callback_request` and `product_category_integrity` are still rejected by `AuditLog.entityType`.

---

## Phase 2: Real delivery workflow

### 2.1 Delivery lifecycle (server-side, visible to everyone)
New `order.delivery` sub-document (`orderStatus` stays the customer-facing status):

```
assigned → accepted → picked_up → en_route → arrived → delivered
   ↘ declined / expired (→ next driver or admin alert)      ↘ failed → returned → reattempt
```

- [x] `models/Order.js`: `delivery: { stage, assignedAt, acceptedAt, pickedUpAt, enRouteAt, arrivedAt, returnedAt,
      pickedItems, missingItems, attempts[], cashDue, cashCollected, changeGiven, pinFailures, offsite }`.
      Orders created before this get a matching run on first use.
- [x] Endpoints: `POST /driver/deliveries/:id/accept | reject | pickup | arrive | attempts | returned`.
      Each is a guarded atomic update, so a repeated tap is a no-op.
- [x] **Pickup dispatches the order**: picking up a confirmed or preparing order moves it to out-for-delivery,
      records it in the history, starts tracking, generates the delivery code, and notifies the customer.
- [x] Accept timeout (`driverSettings.acceptTimeoutMin`, 0 = off): a job every minute releases assignments
      nobody accepted and offers them to the next driver (auto-assign) or alerts the admin.
- [x] Picking checklist is saved on the server at pickup, and missing items alert the admin.
- [x] `arrive` sets tracking `status: 'arrived'`, and the customer gets an in-app notice and an SMS.
- [x] The first GPS ping after pickup moves the run to `en_route`.
- [x] `DriverDeliveryStepper` reads the server stage (Assigned → Picked up → On the way → Arrived → Delivered).
- [x] `driverSettings.allowReject` (default on).
- [ ] Flip `assignDispatchesOrder` to `false` by default once stores have tried the pickup flow
      (left `true` so existing behaviour doesn't change).

### 2.2 Proof of delivery
- [x] **Delivery code**: 4 digits, generated when the order goes out for delivery. It is texted to the customer and
      shown on their order page, and never sent to the driver app. Wrong codes are counted; after 5 the
      order locks and the admin is alerted. Setting: `requireDeliveryPin` (off / COD only / all).
- [x] **Geofence** (`geofenceMeters`, 0 = off): completing farther than the limit, or with no GPS fix, needs a
      reason. The distance and reason are stored and the admin is alerted.
- [x] `requireProofPhoto` (optional / when no code / always).
- [x] API errors carry a `code` (`PIN_INVALID`, `PIN_LOCKED`, `PHOTO_REQUIRED`, `CASH_REQUIRED`,
      `OUTSIDE_GEOFENCE`, `ATTEMPTS_REQUIRED`, `NOT_READY`, `EXCEEDS_BALANCE`). The driver app shows them in Arabic or English.

### 2.3 Cash on delivery and reconciliation
- [x] COD completion requires the cash received (at least the amount due); `cashCollected` and `changeGiven`
      are stored. Setting `cashTrackingEnabled` (default on).
- [x] `models/DriverCashLedger.js` + `User.driverCashBalance`. Collections are idempotent per order (unique index).
- [x] Driver app: a "Cash held" stat card, and the balance and movements on the account page.
- [x] Admin **Driver cash** page (`/admin/driver-cash`): balances, ledger, record handover (cannot exceed the
      balance), and correct the balance (reason required). Both actions are audited.

### 2.4 Failed delivery → next step
- [x] Call and WhatsApp taps log contact attempts. "Could not reach" and "customer unavailable" need
      `failMinContactAttempts` first (the dialog explains how many are missing).
- [x] The driver confirms "items returned to the store" (stage `returned`), and the admin is alerted.
- [x] The admin **Reattempt** button on a failed order: back to preparing, a fresh run, and a new code.
      The driver picks it up again. To give up, the admin uses the existing cancel (which restores stock).
- [ ] Customer self-service reschedule link (needs a slot picker on the storefront).

### 2.5 Return pickups
- [x] Admin: on an approved home-pickup return, pick the **pickup driver** (return card in the order panel and the
      Returns page). The driver gets a notice that links straight to the task.
- [x] Driver app: a "Return pickups" section in the list, and a pickup screen with the item, reason, slot, address,
      navigation, and call/WhatsApp.
- [x] "On my way" → the customer's return tracker shows "Agent on the way", plus an in-app notice.
- [x] "Collected" records the condition (and an optional photo), completes the return, and sets the order to `returned`.
      A condition different from the customer's report alerts the store.
- [x] "Not collected" needs a note. The return goes back to "confirmed" without a driver, and the store is alerted.
- [x] Also fixed: return audit entries (`cancel`, `return_request`, `return_fulfillment`) were rejected by the
      audit enum.

---

## Phase 3: Reliable GPS and real-time (mobile)

### 3.1 One location stream per driver
- [x] New `PUT /orders/driver/location` (driver-level). The server applies the position to **all** of the
      driver's out-for-delivery orders, moves their runs to `en_route`, and stores `User.driverLastLocation`.
      The rate limit is per driver (20/min).
- [x] `useDriverShiftLocation` runs in `DriverLayout`: it starts automatically when the driver has orders on the
      road and keeps running on every screen (verified in a browser on the account page with 2 orders). The header
      bar shows "sharing for N deliveries", or the error with a Retry button. Wake lock and a leave-page warning
      apply while it runs.
- [x] Adaptive sending: every 5 s above ~29 km/h, otherwise after 25 m of movement, and at least every 30 s
      (with a heartbeat for devices that only report on movement).
- [x] The old per-order hook (`useDriverGeolocation`) is removed. The per-order endpoint stays for compatibility
      and for the dev simulator.

### 3.2 Native Android (Capacitor)
- [ ] Not started: the repo has no `android/` project yet (only `capacitor.config.json`). Once one is added:
      a background-geolocation plugin with a foreground-service notification, so GPS survives screen lock
      and Waze, plus a battery-optimisation prompt (`capacitor-native-settings` is already installed).
      `useDriverShiftLocation` is the single place to swap in the native plugin.
- [ ] Offline queue: buffer location points and contact attempts in IndexedDB and replay them on reconnect.
      Complete and fail stay online-only on purpose, because the code, cash and geofence checks need the server.
      Retries are already safe (Phase 1).

### 3.3 Push and real-time
- [x] **Web Push** for drivers: `PushSubscription` model, `/api/push/config | subscribe`, and the
      `public/driver-sw.js` service worker (scope `/driver`). Assign, dispatch, pickup-task and unassign notices
      are pushed to the phone. Tapping a notification opens or focuses the right screen. Dead subscriptions
      (404/410) are pruned.
      The driver turns it on from a banner on the list or a toggle on the account page.
      **Setup:** `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
      `VAPID_SUBJECT` (see `backend/.env.example`). Without keys the feature stays hidden.
      Verified: subscription storage and send (stubbed push service), service-worker registration, and the
      notification display through a DevTools push.
- [ ] Optional: server-sent events for the driver list and the admin live map, replacing the 30 s and 9 s polling.

---

## Phase 4: Smarter dispatch and driver experience

- [x] Auto-assign ranking: fewest active deliveries → **closest to the pickup branch** (driver's GPS in the
      last 15 min vs. the order's fulfillment location) → idle longest. Drivers with no recent GPS rank after
      located ones at the same load.
- [ ] Driver profile: vehicle type, capacity, home zones and branch (`fulfillmentLocationId`), with zone filtering in auto-assign.
- [ ] Batching: suggest grouping orders that share a zone and slot onto one driver.
- [x] Multi-stop route: "Start route — N stops" orders the active stops nearest-first and opens Google Maps with
      waypoints. It opens synchronously inside the tap, so phone browsers don't block it.
- [x] Driver performance on the account page: delivered, failed, success rate, average delivery minutes, and cash
      collected, for Today / 7 days / 30 days (`GET /orders/driver/stats`).
- [x] History: server pagination (`page`, `limit`, `from`, `to`) with "Load more". Today's counts come from the stats endpoint.
- [ ] UX: swipe-to-confirm, dark mode for night shifts, full Arabic-first copy review.

---

## Phase 5: Admin tools for drivers

- [ ] Live map: a "reassign" action from the map, and the driver's trail for the current order.
- [x] **Driver performance** page (`/admin/driver-performance`): delivered, failed, success rate, average
      assign→delivered time, declines, expired assignments, away-from-address and missing-at-pickup flags,
      cash held, and last GPS, for Today / 7 / 30 days.
- [x] Delivery timeline on the order panel: assigned → accepted → picked up → on the way → arrived (→ returned),
      plus missing items, cash, geofence flag, wrong-code count, the delivery code for support, and Reattempt.

---

## Phase 6: Quality and testing

- [x] Add a backend test setup (`node:test` or Vitest with `mongodb-memory-server`).
- [x] Tests: complete is idempotent (double call gives one loyalty award), driver cannot touch another driver's
      order, PIN and geofence rules, cash ledger balances, auto-assign ranking, and location fan-out.
- [x] End-to-end flow (assign → accept → pickup → location → arrive → complete with code and cash) is covered by
      `tests/driverWorkflow.test.js` against a real MongoDB (`npm test`, 49 tests), and was exercised in a browser.
- [ ] Manual QA on a real Android phone: screen locked, switching to Waze, offline then back online, 3 parallel orders.

---

## Suggested order and size

| Step | Content | Size | Why this order |
|------|---------|------|----------------|
| 1 | Phase 1 (1.1–1.3) | S (1–2 days) | Fixes real bugs (double points, fake pin, heavy pings) with no new UI |
| 2 | 2.1 lifecycle + 2.3 cash | M | Biggest operational value; everything later builds on `delivery.stage` |
| 3 | 3.1 driver-level GPS | S–M | Fixes tracking for multi-order drivers, even on web |
| 4 | 2.2 PIN/geofence + 2.4 failures | M | Trust and accountability |
| 5 | 3.2 native and 3.3 push | M–L | Needs an Android build and FCM keys |
| 6 | Phase 4 and Phase 5 | L | Optimisation once the basics are solid |
| ∞ | Phase 6 | ongoing | Write the tests alongside each phase, not at the end |
