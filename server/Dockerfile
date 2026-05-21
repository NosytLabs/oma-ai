FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 oma
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER oma
EXPOSE 3001
ENV PORT=3001 \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1536"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]
