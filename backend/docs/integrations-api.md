# MarketPlus Integrations API (v1)

Connect a cashier/POS, ERP, accounting or warehouse system to the store.
Everything here is also shown in **Admin → Settings → Connected systems → Developer docs**.

- Base URL: `https://<your-store>/api/integrations/v1`
- Format: JSON in, JSON out (`{ "success": true, "data": … }` or `{ "success": false, "message": "…" }`)
- Limit: 600 requests per minute per key, at most 5,000 items per call

## 1. Getting a key

The store owner creates a **connection** in the admin and copies its API key (shown once).
Send it on every call:

```
Authorization: Bearer mpk_xxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(`X-Api-Key: mpk_…` also works.) Each key only opens the permissions ticked on its connection:

| Permission       | Allows                                             |
|------------------|----------------------------------------------------|
| `stock:write`    | `PUT /stock`, `POST /stock/adjustments`, `POST /files` |
| `prices:write`   | `PUT /prices`, `POST /files`; cost prices in `GET /products` |
| `products:read`  | `GET /products`                                    |
| `orders:read`    | `GET /orders`, `GET /orders/{ref}`                 |
| `orders:write`   | `POST /orders/{ref}/acknowledge`                   |
| `locations:read` | `GET /locations`                                   |

Keys can be limited to fixed IP addresses and replaced at any time (the old key stops at once).

## 2. Test mode and dry runs

- Turn on **Test mode** on the connection: every call is checked and answered as usual, but
  nothing is saved and no webhooks go out. Use it while building your connector.
- Or add `?dryRun=true` (or header `X-Dry-Run: true`) to a single call. The answer includes a
  `preview` of what would change.

## 3. Matching products

Products are matched by **barcode or SKU** — product or variant — ignoring spaces and
upper/lower case. Barcodes that lost their leading zeros in Excel still match.
Codes that match nothing come back in `unmatched` and are listed in the admin.
Marketplace (outside seller) products are never touched.

## 4. Stock

### Report what you have — `PUT /stock`

```json
{
  "items": [
    { "barcode": "6221234567890", "quantity": 24 },
    { "sku": "RICE-5KG", "quantity": 7, "location": "BR2" }
  ]
}
```

`code`, `barcode` or `sku` all work. `location` is **your** branch code (the owner maps it to a
store branch in the admin) or one of our branch ids from `GET /locations`; leave it out for the
connection's default branch. Sending the same numbers twice changes nothing.

Answer:

```json
{ "success": true, "data": { "received": 2, "updated": 1, "unchanged": 1, "unmatched": [], "failed": [], "dryRun": false, "replayed": false } }
```

### Report a movement — `POST /stock/adjustments`

For systems that only know "sold 3" or "received 10":

```json
{ "reference": "RCPT-2026-001234", "items": [ { "barcode": "6221234567890", "change": -3 } ] }
```

`reference` is required and must be unique per movement (receipt number, transfer number…).
A repeat with the same reference is ignored and answered with `"replayed": true`.

### How the website stock is worked out

```
website stock = your stock at branches that sell online − safety buffer − online orders on hold
```

- **Safety buffer**: set by the owner (e.g. 2) so the last item on the shelf is not sold online.
- **On hold**: an online order's items stay subtracted until your system has taken them out
  itself, so your next report does not "give them back". The owner picks when that is:
  when you **acknowledge** the order (`ack`), when the order is **delivered**, or never.

## 5. Prices — `PUT /prices`

Only works when the owner made your connection the "boss" of prices.

```json
{ "items": [ { "barcode": "6221234567890", "price": 32.5, "oldPrice": 40, "costPrice": 25 } ] }
```

`oldPrice` shows a crossed-out price (0 or `null` removes it; it is dropped if not above the
price). `costPrice` is only applied when cost prices are allowed too. Send an
`Idempotency-Key` header to make retries safe.

## 6. Files — `POST /files`

Upload a CSV/TSV (any separator, UTF-8) or Excel `.xlsx` export, as multipart field `file` or
as the raw body with `?filename=stock.xlsx`. The column mapping saved on the connection
decides which column is the barcode, quantity, price, cost, old price and branch.

## 7. Products — `GET /products`

`?updatedSince=2026-01-01T00:00:00Z&page=1&limit=100` (max 500) or `?code=6221234567890`.
Returns id, names, barcode, SKU, unit, price, oldPrice, stock, available (stock minus items in
customers' checkouts), variants, and `costPrice` when the key has `prices:write`.

## 8. Online orders

### `GET /orders`

| Query             | Meaning                                                        |
|-------------------|----------------------------------------------------------------|
| `cursor`          | `nextCursor` from the previous page — never misses an order    |
| `since`           | ISO date; first call only                                      |
| `status`          | comma list: `pending,preparing,out_for_delivery,delivered,delivery_failed,returned,cancelled` |
| `unacknowledged`  | `true` = orders of the last 30 days you have not acknowledged  |
| `limit`           | 1–200 (default 50)                                             |

Orders come oldest change first, with `hasMore` and `nextCursor`. Each order has `number`,
`status`, `paymentStatus`, `paymentMethod`, totals, `customer`, `deliveryAddress`, `delivery`
(date, time slot, branch id), `items` (barcode, sku, name, quantity, unitPrice, lineTotal,
`fulfilledBy`: `store` or `seller` — only `store` lines come from your stock), approved
`returns`, `acknowledged` and `externalReference`.

### `POST /orders/{id or number}/acknowledge`

"We have taken these items out of our stock." Optional body `{ "externalReference": "POS-INV-7781" }`.
Safe to repeat.

## 9. Webhooks (we call you)

The owner sets your URL and picks events on the connection:
`order.created`, `order.paid`, `order.status_changed`, `order.cancelled`, `order.return_approved`.

```
POST https://your-system/webhook
X-MarketPlus-Event: order.created
X-MarketPlus-Event-Id: order.created:66f…:created
X-MarketPlus-Timestamp: 1767225600
X-MarketPlus-Signature: sha256=5d41402abc4b2a76b9719d911017c592…

{ "id": "order.created:66f…:created", "event": "order.created", "createdAt": "…", "data": { "order": { … } } }
```

`order.status_changed` also has `data.previousStatus`; `order.return_approved` has `data.return`.

**Check the signature** with the webhook secret from the admin:

```js
const expected = crypto.createHmac('sha256', SECRET)
  .update(`${req.headers['x-marketplus-timestamp']}.${rawBody}`)
  .digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(`sha256=${expected}`), Buffer.from(req.headers['x-marketplus-signature']));
```

Also reject timestamps older than 5 minutes. Answer any 2xx within 10 seconds; anything else
is retried after 1 min, 5 min, 30 min, 2 h, 6 h, 12 h and 24 h, then marked failed (the owner
can resend it). Events can arrive twice or out of order — use `X-MarketPlus-Event-Id` to
ignore repeats and `data.order.updatedAt` to keep the newest.

## 10. Errors

| HTTP | Meaning                                                   |
|------|-----------------------------------------------------------|
| 400  | Something in the request is wrong — `message` says what   |
| 401  | Key missing, wrong or replaced                            |
| 403  | Connection paused, IP not allowed, or permission missing  |
| 404  | Order/product not found                                   |
| 429  | Too many requests — wait a minute                         |
| 5xx  | Our side — retry later with the same Idempotency-Key      |

Item-level problems never fail the whole call: they are listed in `failed` and `unmatched`.

## 11. The shop-PC agent

For desktop cashier programs with no internet features, install the agent on the shop PC
(`backend/integrations-agent/`): it reads an export folder, a SQL Server database or any ODBC
source (MS Access), sends changes with the connection key, queues them while offline, saves
new online orders as files for the cashier program, and updates itself. See its `README.md`.
