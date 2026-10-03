# MarketPlus API (Express + MongoDB)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=5001
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5001/api/health || exit 1
CMD ["node", "src/server.js"]
