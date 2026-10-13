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
- [ ] Not driver scope: the same enum gap also drops audit entries for `cancel`, `return_request` and
      `return_fulfillment`, and for several entity types (`staff_account`, `support_conversation`, `chat_agent`,
      `callback_request`, `product_category_integrity`).

---

## Phase 2: Real delivery workflow

### 2.1 Delivery lifecycle (server-side, visible to everyone)
New `order.delivery` sub-document (keep `orderStatus` for compatibility):

```
assigned → accepted → picked_up → en_route → arrived → delivered
                 ↘ rejected (→ auto-reassign)      ↘ failed → reattempt | returned_to_store
```

- [ ] `models/Order.js`: `delivery: { stage, acceptedAt, pickedUpAt, arrivedAt, attempts[], returnedAt }`
- [ ] Endpoints: `POST /driver/deliveries/:id/accept | reject | pickup | arrive`
- [ ] Optional accept timeout (`driverSettings.acceptTimeoutSec`). After it expires, auto-reassign
      (`pickAutoAssignDriver({ excludeId })`) and alert the admin.
- [ ] Picking checklist is saved on the server at pickup (`pickedItems`), and missing items are flagged to the admin.
- [ ] `arrive` sets tracking `status: 'arrived'`, so the customer sees "Driver at your door" and gets an SMS.
- [ ] `DriverDeliveryStepper` reads its step from the server, not localStorage.

### 2.2 Proof of delivery
- [ ] **Delivery PIN**: a 4-digit code generated when the order goes `out_for_delivery`, shown on the
      customer's order page and in the SMS. The driver enters it to complete.
      Setting: `driverSettings.requireDeliveryPin` (off / COD only / all).
- [ ] **Geofence**: on complete, compare the last GPS fix with the destination. Beyond
      `driverSettings.geofenceMeters` (default 300 m), require a reason and flag the order for the admin.
- [ ] Setting `requireProofPhoto` (off / when no PIN / always).

### 2.3 Cash on delivery and reconciliation
- [ ] On complete for COD: the driver enters `cashCollected`. The server stores `cashCollected` and `changeGiven`,
      and flags a mismatch against the amount due (`total`, already net of wallet and discounts).
- [ ] `models/DriverCashLedger.js`: one entry per collection, plus `handover` entries.
      Reuse the atomic ledger pattern from `wallet.service.js`.
- [ ] Driver home: "Cash in hand: 1,240 EGP".
- [ ] Admin: **Cash handover** screen. The admin confirms the amount received from a driver, which writes a ledger
      entry, records the difference, and logs an audit entry.

### 2.4 Failed delivery → next step
- [ ] Log call attempts (tap "Call" → `attempts[{ at, type: 'call' }]`). The "customer not answering" reason
      requires at least N attempts and a wait of X minutes (settings).
- [ ] After a failure, the admin chooses **Reattempt** (new slot, same or another driver) or **Return to store**.
      When the driver confirms "items returned", stock is restored if the order is cancelled.
- [ ] Notify the customer with a reschedule link.

### 2.5 Return pickups
- [ ] Home-pickup return requests become driver tasks (`type: 'pickup'`) in the same list,
      with a distinct badge, item-condition check and photo, and "collected / not collected".

---

## Phase 3: Reliable GPS and real-time (mobile)

### 3.1 One location stream per driver
- [ ] New `PUT /driver/location` (driver-level). The server fans the location out to **all** of the driver's
      active orders and keeps `User.lastLocation` for the admin map and auto-assign.
- [ ] Move `useDriverGeolocation` into `DriverLayout` (a shift-wide hook), so it keeps running across pages.
      It starts on "Online" or when the driver has active orders, and stops when offline with no active orders.
- [ ] Adaptive sending: about 5 s when moving fast, 30 s when stationary, skip if moved less than 15 m.
      Make the rate limiter key per driver, not per order.

### 3.2 Native Android (Capacitor)
- [ ] Add a background geolocation plugin with an Android foreground service and a persistent
      "Delivering — sharing location" notification, so GPS survives screen lock and switching to Waze.
- [ ] Battery-optimisation prompt (`capacitor-native-settings` is already installed).
- [ ] Offline queue: buffer location points and complete/fail/arrive actions in IndexedDB, then replay
      in order when the connection returns (each with an idempotency key, from Phase 1.1).

### 3.3 Push and real-time
- [ ] Push notifications (FCM through Capacitor; Web Push for the PWA) for new assignment, reassignment,
      order changes and admin messages, with sound and vibration for new orders.
- [ ] Optional: server-sent events for the driver list and the admin live map, replacing the 30 s and 9 s polling.

---

## Phase 4: Smarter dispatch and driver experience

- [ ] Auto-assign scoring: active load + **distance from driver (`lastLocation`) or store to destination** +
      zone match + idle time. Today it uses least-busy only.
- [ ] Driver profile: vehicle type, capacity, home zones and branch (`fulfillmentLocationId`).
- [ ] Batching: suggest grouping orders that share a zone and slot onto one driver.
- [ ] Multi-stop route: "Start route" orders the stops (nearest-neighbour, or the OSRM `trip` API) and
      opens Google Maps with waypoints.
- [ ] Driver home dashboard: today's deliveries, km driven, on-time %, cash in hand, and earnings
      (per-delivery fee and zone bonus from settings).
- [ ] History: pagination, a date filter, and a daily summary.
- [ ] UX: large tap targets, a swipe-to-confirm slider for Complete (prevents accidental taps),
      dark mode for night shifts, and full Arabic-first copy review.

---

## Phase 5: Admin tools for drivers

- [ ] Live map: stale-GPS alerts, a "reassign" action from the map, and the driver's trail for the current order.
- [ ] Driver performance page: delivered/failed counts, average time from assign to delivery, on-time rate,
      geofence flags and cash mismatches.
- [ ] Delivery timeline on the order panel: assigned → accepted → picked up → arrived → delivered, with timestamps
      and who did each step.

---

## Phase 6: Quality and testing

- [x] Add a backend test setup (`node:test` or Vitest with `mongodb-memory-server`).
- [ ] Tests: complete is idempotent (double call gives one loyalty award), driver cannot touch another driver's
      order, PIN and geofence rules, cash ledger balances, auto-assign ranking, and location fan-out.
- [ ] `scripts/acceptance-driver-flow.js`: seed → assign → accept → pickup → location → arrive → complete with PIN.
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
