#!/usr/bin/env bash
# Runs once when the codespace is created: install deps, write dev .env files, seed demo data.
set -euo pipefail
cd "$(dirname "$0")/.."

npm install

# Public URL of the website port (Codespaces), used for CORS and email/payment links.
if [ -n "${CODESPACE_NAME:-}" ]; then
  SITE_URL="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
  SITE_URL="http://localhost:5173"
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i \
    -e "s#^MONGODB_URI=.*#MONGODB_URI=mongodb://mongo:27017/marketplus#" \
    -e "s#^CLIENT_URL=.*#CLIENT_URL=${SITE_URL}#" \
    backend/.env
  cat >> backend/.env <<ENV

# ── Codespaces ──
CORS_ORIGINS=${SITE_URL}
MEILI_HOST=http://meilisearch:7700
MEILI_API_KEY=codespaces_dev_master_key_0123456789
SMS_DEV_MODE=true
ENV
fi

if [ ! -f frontend/.env ]; then
  printf 'VITE_API_URL=/api\nVITE_USE_OSM_MAP=true\n' > frontend/.env
fi

# Demo catalog + accounts (fresh database only).
npm run seed
npm run seed:demo-seller --prefix backend || true
npm run search:reindex --prefix backend || true

# Claude Code CLI, so you can run `claude` in the codespace terminal.
npm install -g @anthropic-ai/claude-code || true

echo "Setup done. The site starts automatically; or run: npm run dev"
