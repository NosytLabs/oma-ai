FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci && npm cache clean --force

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BASE_TREASURY
ARG NEXT_PUBLIC_SOLANA_TREASURY
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_BASE_TREASURY=$NEXT_PUBLIC_BASE_TREASURY \
    NEXT_PUBLIC_SOLANA_TREASURY=$NEXT_PUBLIC_SOLANA_TREASURY \
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY next.config.ts ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1
CMD ["node", "server.js"]
