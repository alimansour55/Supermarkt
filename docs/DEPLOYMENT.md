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
| Secrets | Cloudinary, Stripe (live), SMTP, Twilio, Google Maps, OpenAI — whichever you use. |

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
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
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

Stripe: add the webhook endpoint `https://www.yourstore.com/api/payment/webhook` in the Stripe dashboard.

## 7. Updating

```bash
cd /opt/marketplus
git pull
docker compose up -d --build
docker image prune -f
```

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
