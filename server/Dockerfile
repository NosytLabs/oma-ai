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
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S oma && adduser -S oma -u 1001 -G oma
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/models.json ./models.json
USER oma
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
