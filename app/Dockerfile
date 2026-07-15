FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds --prod

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds
COPY . .
# Clear stale Next.js cache that can cause PageNotFoundError
RUN rm -rf .next
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Use standalone output — Next.js produces a minimal server bundle in
# .next/standalone that excludes devDependencies (~250MB savings).
# The standalone server.js is the entry point; no pnpm/node_modules needed.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN addgroup -g 1001 -S oma && adduser -S oma -u 1001 -G oma
USER oma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
