# MarketPlus storefront — React Router SSR server.
# Build context is the repository root (vite.config.js imports ../scripts/lan-address.mjs):
#   docker build -f frontend/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY scripts/ /app/scripts/
COPY frontend/ ./
# Browser-side API base; same-origin /api works behind the bundled Caddy proxy.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:24-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/frontend/build ./build
COPY frontend/server.js frontend/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt || exit 1
CMD ["node", "server.js"]
