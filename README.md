# سوق+ | MarketPlus

Full-stack supermarket e-commerce platform with **Arabic RTL-first** design, inspired by the layout and shopping experience of modern Egyptian grocery sites (e.g. Carrefour Egypt) — using **100% original MarketPlus branding** (no third-party logos or assets).

## Features

| Area | Highlights |
|------|------------|
| **Storefront** | Hero slider, category rail, product grids, offers, search, cart drawer, checkout |
| **RTL / i18n** | Arabic default (RTL) at `/ar/...`, English at `/en/...`, Cairo font |
| **SEO** | Server-rendered public pages, canonical + hreflang, JSON-LD, sitemap.xml, robots.txt |
| **Responsive** | Mobile, tablet, and desktop layouts |
| **Auth** | Register, login, JWT, email verification, password reset |
| **Cart & checkout** | Scheduled/express delivery, coupons, COD + Stripe Checkout |
| **Admin** | Dashboard, products, categories, orders, users, coupons, banners |
| **Media** | Cloudinary uploads (products, categories, banners) |
| **Security** | bcrypt, JWT, rate limits, CORS, input validation |

## Tech Stack

- **Frontend:** React 19, React Router 7 (framework mode, SSR), Vite, Tailwind CSS 4, Axios, Context API
- **Mobile app:** Capacitor (static SPA build of the same code)
- **Backend:** Node.js, Express 5, MongoDB, Mongoose
- **Payments:** Stripe Checkout + webhooks
- **Email:** Nodemailer (optional in dev)

## Project Structure

```
Project supermarket/
├── frontend/          # React storefront + admin (React Router SSR, RTL)
│   ├── src/routes.js  # Route config (/ar, /en storefront; /admin; /driver)
│   ├── src/routes/    # SSR route modules: loaders, meta/SEO, sitemap, robots
│   └── server.js      # Production SSR server
├── backend/           # Express REST API + seed data
├── e2e/               # Playwright smoke + SEO tests
├── deploy/            # Caddyfile + env template for the VPS
├── docs/DEPLOYMENT.md # Step-by-step VPS deployment + SEO launch checklist
├── docker-compose.yml # Production stack (Caddy + web + api [+ mongo])
└── package.json       # Monorepo scripts (dev, install, seed, tests)
```

## Prerequisites

- **Node.js 22+** (24 recommended)
- **MongoDB** running locally or MongoDB Atlas connection string

Optional for full features:

- Stripe test keys (online payments)
- Cloudinary credentials (image uploads in admin)
- SMTP credentials (real emails; dev simulates without SMTP)

---

## Setup (step by step)

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

This installs root, frontend, and backend packages.

### 2. Environment files

```bash
# Backend — required
cp backend/.env.example backend/.env

# Frontend — optional (defaults work with Vite proxy)
cp frontend/.env.example frontend/.env
```

**Minimum `backend/.env` for local dev:**

```env
MONGODB_URI=mongodb://127.0.0.1:27017/marketplus
JWT_SECRET=dev_jwt_secret_at_least_32_characters_long
CLIENT_URL=http://localhost:5173
```

**Frontend `.env` (optional):**

```env
# Uses the dev-server proxy to the backend when omitted — /api → localhost:5001
VITE_API_URL=/api
```

> Never put secret keys (`sk_`, `JWT_SECRET`, Cloudinary secret) in the frontend. Only `VITE_*` public variables belong in `frontend/.env`.

### 3. Start MongoDB

Local example:

```bash
# Windows (if MongoDB installed as service)
net start MongoDB

# macOS/Linux
mongod
```

Or set `MONGODB_URI` to your Atlas cluster in `backend/.env`.

### 4. Seed demo data

```bash
npm run seed
```

Creates:

- 12 categories
- 24 products (Arabic + English names, prices in EGP)
- 3 coupon codes
- Hero & promo banners
- Admin user: `admin@marketplus.com` / `admin123`

### 5. Run development servers

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Storefront (Arabic) | http://localhost:5173/ar |
| Storefront (English) | http://localhost:5173/en |
| Admin panel | http://localhost:5173/admin/login |
| API | http://localhost:5001 |
| Health check | http://localhost:5001/api/health |

---

## Demo accounts

| Role | Phone | Notes |
|------|-------|-------|
| Admin | `01012345678` | SMS OTP at `/admin/login` — code in backend console when Twilio is off |

**Customers:** Register at `/register` with **name + mobile only**. Every sign-in uses **SMS MFA** (6-digit code).

### SMS / MFA setup (optional)

Add to `backend/.env` for production SMS via Twilio:

```env
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

Without Twilio, OTP codes are printed to the backend terminal in development.

## Demo coupon codes

| Code | Effect |
|------|--------|
| `FIRST20` | 20% off (min 100 EGP) |
| `SAVE50` | 50 EGP off (min 300 EGP) |
| `FREESHIP` | Free delivery |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install all dependencies |
| `npm run dev` | Frontend + backend concurrently |
| `npm run dev:frontend` | Storefront dev server only (port 5173, SSR) |
| `npm run dev:backend` | API only (port 5001) |
| `npm run seed` | Populate MongoDB with demo data (**wipes products/categories**) |
| `npm run build` | Production storefront build (SSR) |
| `npm start --prefix frontend` | Run the built storefront (port 3000) |
| `npm run build:spa --prefix frontend` | Static build for the Capacitor app |
| `npm start` | Start backend (production) |
| `npm run test:e2e` | Playwright smoke + SEO tests (app must be running; set `E2E_BASE_URL` for another server) |

## Deployment & SEO

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the VPS setup (Docker Compose + Caddy HTTPS),
environment variables and the search-engine launch checklist.

---

## UI / UX notes

- **RTL-first:** `/ar/...` pages render `dir="rtl" lang="ar"` on the server; the language toggle moves to the same page under `/en/...` (LTR).
- **Carrefour-style layout:** Top delivery bar → logo + categories + search → nav tabs → hero → category chips → product sections — same *pattern*, original colors and branding.
- **Responsive:** Sticky header, mobile search, horizontal category scroll, collapsible cart drawer.

---

## Stripe (optional)

1. Add test keys to `backend/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
2. Local webhooks:
   ```bash
   stripe listen --forward-to localhost:5001/api/payment/webhook
   ```
3. Choose **Online Payment (Stripe)** at checkout.

---

## Cloudinary (optional)

Add to `backend/.env` for admin image uploads:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Without Cloudinary, the storefront uses seed data and emoji product images.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `JWT_SECRET is required` | Copy `backend/.env.example` → `backend/.env` |
| `MongoDB connection failed` | Start MongoDB or fix `MONGODB_URI` |
| API 404 on frontend | Run `npm run dev` (both servers) or check Vite proxy |
| Empty products | Run `npm run seed` |
| Stripe errors | Use COD, or add valid Stripe test keys |
| CORS errors | Set `CLIENT_URL=http://localhost:5173` in backend `.env` |

---

## License

Private project — all rights reserved.
