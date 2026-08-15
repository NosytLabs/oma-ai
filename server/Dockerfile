FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY app/package.json ./app/
COPY server/package.json ./server/
RUN pnpm install --no-frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY app/package.json ./app/
COPY server/package.json ./server/
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm --filter oma-server run build

FROM node:22-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S oma && adduser -S oma -u 1001 -G oma
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json

RUN chown -R oma:oma /app/server
USER oma
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
