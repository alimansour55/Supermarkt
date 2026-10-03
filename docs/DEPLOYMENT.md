# Deployment (VPS) & SEO launch checklist

The production stack runs on one VPS with Docker Compose:

```
Internet ──► Caddy (HTTPS, :80/:443)
               ├─ /api/*  ──► api  — Express API        (backend/,  port 5001)
               └─ /*      ──► web  — React Router SSR   (frontend/, port 3000)
                                        └─ loads data from http://api:5001/api
MongoDB: MongoDB Atlas (recommended) or the optional `mongo` container
```

Caddy gets and renews the HTTPS certificate automatically (Let's Encrypt).

---

## 1. What you need

| Item | Notes |
|------|-------|
| VPS | Ubuntu 24.04, **2 vCPU / 4 GB RAM** minimum (Hetzner, DigitalOcean, Contabo…). |
| Domain | Pick one canonical host, e.g. `www.yourstore.com`; the other spelling redirects to it. |
| MongoDB | [MongoDB Atlas](https://www.mongodb.com/atlas) M10+ (or the free M0 to start). Atlas is a replica set, which order/wallet transactions need. |
| Secrets | Paymob + Fawry (live), Cloudinary, SMTP, Twilio, Google Maps, OpenAI — whichever you use. |

## 2. DNS

At your domain registrar create:

| Type | Name | Value |
|------|------|-------|
| A | `@` | VPS IPv4 |
| A | `www` | VPS IPv4 |
| AAAA | `@` / `www` | VPS IPv6 (optional) |

## 3. Prepare the server

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Get the code and configure

```bash
git clone https://github.com/alimansour55/Supermarkt.git /opt/marketplus
cd /opt/marketplus
cp deploy/.env.example .env              # domain + SITE_URL
cp backend/.env.example backend/.env     # API secrets
nano .env
nano backend/.env
```

**`.env` (repository root — read by Docker Compose):**

```env
SITE_DOMAIN=www.yourstore.com
REDIRECT_DOMAIN=yourstore.com
SITE_URL=https://www.yourstore.com
ACME_EMAIL=you@yourstore.com
MEILI_MASTER_KEY=<openssl rand -hex 24>
```

**`backend/.env` — production essentials:**

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASS@cluster.xxxxx.mongodb.net/marketplus
JWT_SECRET=<64 random characters: openssl rand -hex 32>
# CLIENT_URL is set from SITE_URL by docker-compose.yml
# Capacitor app origins (Android / iOS) if you ship the mobile app:
CORS_ORIGINS=https://localhost,capacitor://localhost
PAYMOB_SECRET_KEY=egy_sk_live_...
PAYMOB_PUBLIC_KEY=egy_pk_live_...
PAYMOB_HMAC_SECRET=...
PAYMOB_API_KEY=...
PAYMOB_INTEGRATION_CARD=...
PAYMOB_INTEGRATION_APPLE_PAY=...
PAYMOB_INTEGRATION_WALLET=...
PAYMOB_INTEGRATION_VALU=...
FAWRY_MERCHANT_CODE=...
FAWRY_SECURE_KEY=...
FAWRY_ENV=production
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Remove `ADMIN_PASSWORD` once every staff member has a personal account.

## 5. Start

```bash
docker compose up -d --build
docker compose ps            # all services "running"/"healthy"
docker compose logs -f web   # Ctrl+C to stop following
```

Self-hosting MongoDB instead of Atlas:

```bash
# backend/.env → MONGODB_URI=mongodb://mongo:27017/marketplus?replicaSet=rs0
docker compose --profile local-db up -d --build
```

First run on an empty database (creates demo data — **don't run on a live store**):

```bash
docker compose exec api node src/seed/seed.js
```

## 6. Verify

```bash
curl -I https://www.yourstore.com/            # 302 → /ar
curl -I https://yourstore.com/ar               # 301 → https://www.yourstore.com/ar
curl https://www.yourstore.com/robots.txt
curl https://www.yourstore.com/sitemap.xml
curl https://www.yourstore.com/api/health
docker compose logs api | grep "[search]"   # "Indexed N products" = search engine live
```

Run the test suite against the live site from your PC:

```bash
E2E_BASE_URL=https://www.yourstore.com npm run test:e2e
```

Payments: see **Online payments** below.

## 7. Updating

```bash
cd /opt/marketplus
git pull
docker compose up -d --build
docker image prune -f
```

## Online payments (Paymob + Fawry)

| Checkout method | Gateway | Needs |
|---|---|---|
| Card (Visa / Mastercard / Meeza) + Apple Pay | Paymob | `PAYMOB_INTEGRATION_CARD` (+ `PAYMOB_INTEGRATION_APPLE_PAY`) |
| Mobile wallets (Vodafone Cash, Orange, Etisalat, WE Pay) | Paymob | `PAYMOB_INTEGRATION_WALLET` |
| valU instalments | Paymob | `PAYMOB_INTEGRATION_VALU` |
| Pay at Fawry (reference number) | Fawry | `FAWRY_MERCHANT_CODE`, `FAWRY_SECURE_KEY` |
| Cash on delivery | — | always available |

All Paymob methods also need `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY` and `PAYMOB_HMAC_SECRET`.
A method only shows at checkout once its keys are set; the admin **Payment methods** page marks
enabled-but-unconfigured methods with a warning. Customers pay after the order is placed — the
order stays `pending` until the gateway confirms, and can be paid again from the order page.

**Paymob setup**
1. Dashboard → Settings → API Keys: copy the Secret key, Public key, HMAC secret and API key.
2. Settings → Payment Integrations: copy each integration id (test ids while testing, live ids for launch — they must match the key mode).
3. Nothing to configure for callbacks: every payment sends its own callback URL
   (`https://www.yourstore.com/api/payment/paymob/webhook`, signed with your HMAC secret).
4. Apple Pay: ask Paymob to enable it and verify your domain; then set `PAYMOB_INTEGRATION_APPLE_PAY`.
5. Test with Paymob's sandbox cards (e.g. 5123 4567 8901 2346, 01/39, CVV 123) and wallet 01010101010 / PIN 123456 / OTP 123456.
   valU and kiosk methods have no sandbox — verify them with one small live payment.

**Fawry setup**
1. Get the merchant code and secure key from Fawry (staging first, then production; set `FAWRY_ENV=production` for live).
2. Ask Fawry to enable server notifications (V2). The callback URL is sent with every charge:
   `https://www.yourstore.com/api/payment/fawry/webhook`.
3. Reference numbers expire after `FAWRY_EXPIRY_HOURS` (default 48); an expired reference marks the order's payment failed.

**Refunds** (order cancel, admin refund, approved return) go back through the gateway for cards and wallets.
Fawry cash payments and valU can't be refunded electronically: the refund is recorded as
`manual_required` on the order and the admin response says so — pay the customer back (e.g. store wallet).

**Safety**: payment state changes only on a verified signature (Paymob HMAC-SHA512, Fawry SHA-256) or a direct
status query to the gateway; amounts are checked against the order total; duplicate callbacks are no-ops.

## Push notifications (Firebase)

Dormant until `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 or raw JSON) or `FIREBASE_SERVICE_ACCOUNT_FILE`
is set in `backend/.env`. Then every customer notification (order status, wallet, support) is also
pushed to the customer's phones in their app language, and admin → **App push notifications** can
broadcast offers to all app users. App-side setup (google-services.json, GoogleService-Info.plist,
APNs key) is in the Flutter project's `PUSH_SETUP.md`.

## Product search (Meilisearch)

Search runs on Meilisearch: typo-tolerant, Arabic-normalized (أ/إ/آ → ا, ة → ه, ى → ي, Arabic digits),
bilingual synonyms (`backend/src/constants/searchSynonyms.js` — milk / حليب / لبن …), ranked by relevance,
then by best sellers. MongoDB still applies every filter (category, brand, price, stock).

- The index is rebuilt from MongoDB on every API start and every 6 hours; product and category edits sync within ~2 seconds.
- Rebuild by hand: `docker compose exec api npm run search:reindex`, or `POST /api/search/admin/engine/reindex` (admin, `products:write`).
- Status: `GET /api/search/admin/engine` (admin) shows which engine is serving and the index size.
- If Meilisearch is down, search falls back to MongoDB automatically and switches back when it recovers.

## 8. Backups & monitoring

- **Atlas:** turn on continuous backups. Self-hosted: nightly `docker compose exec mongo mongodump --archive > backup-$(date +%F).gz` copied off the server.
- **Uptime:** free monitor (UptimeRobot / Better Stack) on `https://www.yourstore.com/api/health` and `/ar`.
- **Errors:** add Sentry to frontend and backend (recommended next step).

---

## Environment variables reference

### Storefront (`web` service)

| Variable | Purpose |
|----------|---------|
| `SITE_URL` | Public origin for canonical URLs, hreflang, Open Graph, sitemap. **Required in production.** |
| `API_INTERNAL_URL` | API base used by server-side loaders (`http://api:5001/api` in Compose). |
| `API_PROXY_TARGET` | Optional: proxy `/api` from the SSR server itself (not needed behind Caddy). |
| `TRUST_PROXY` | Express `trust proxy` setting (default: private networks). |
| `VITE_API_URL` | Build-time browser API base (default `/api`). Set to `https://www.yourstore.com/api` for the Capacitor build. |

### API (`api` service)

See `backend/.env.example`. `TRUST_PROXY` defaults to private networks so rate limits see real client IPs behind Caddy.

---

## Mobile app (Capacitor)

```bash
cd frontend
VITE_API_URL=https://www.yourstore.com/api npm run build:spa
npx cap sync
```

The app bundle is `frontend/build-spa/client` (configured in `capacitor.config.json`).

---

## SEO launch checklist

**Before launch**

- [ ] Admin → Settings → Identity: Arabic **and** English store name, tagline, SEO title/description, OG image (1200×630), favicon. *(The English store name is currently Arabic and the tagline is "hi hi hi".)*
- [ ] Admin → SEO "allow search engines" is on (it drives `robots.txt` and the robots meta tag).
- [ ] Every product has a real photo (Cloudinary) and an Arabic + English description. Products without images can't appear in Google Shopping/image results.
- [ ] Category descriptions for the main departments (they become the page meta description).
- [ ] Content pages (About, FAQ, Contact, Returns, Privacy, Terms) filled in both languages.
- [ ] Google Analytics ID in admin SEO settings (optional; adds gtag.js).

**Launch day**

1. Open [Google Search Console](https://search.google.com/search-console) → **Add property** → *Domain* → verify with the DNS TXT record.
2. **Sitemaps** → submit `https://www.yourstore.com/sitemap.xml`.
3. **URL inspection** → test `/ar`, one product and one category → *Request indexing*.
4. [Rich Results Test](https://search.google.com/test/rich-results) on a product URL → Product + Breadcrumb should be valid.
5. [PageSpeed Insights](https://pagespeed.web.dev/) on `/ar` and a product (mobile).
6. Bing Webmaster Tools → import from Search Console.

**Weekly**

- Search Console → *Pages* (indexing errors), *Core Web Vitals*, *Search results* (queries to write content for).

### How the SEO works (for developers)

- Public pages (`/ar|en`, products, categories, listings, offers, brands, CMS pages) are server-rendered by route modules in `frontend/src/routes/`: a `loader` fetches data from the API, `meta` builds title/description/canonical/hreflang/Open Graph/JSON-LD (`frontend/src/seo/`).
- Private areas (cart, checkout, account, login, search, admin, driver) render in the browser only and are `noindex` + disallowed in `robots.txt`.
- Filtered/sorted listing URLs are `noindex`; plain listings and `?page=N` are indexable with self-canonicals.
- Old URLs without a language prefix 301 to `/ar/...`; `/categories/:slug` 301s to the full `/category/...` path; renamed product slugs 301 to the current slug.
- Internal links get the current language prefix automatically (`frontend/src/app/router.jsx`) — always import router APIs from there.
