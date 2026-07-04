FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN addgroup -g 1001 -S oma && adduser -S oma -u 1001 -G oma
USER oma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["pnpm", "run", "start"]