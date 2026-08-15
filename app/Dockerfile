FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY app/package.json ./app/
COPY server/package.json ./server/
RUN pnpm install --no-frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY app/package.json ./app/
COPY server/package.json ./server/
RUN pnpm install --no-frozen-lockfile
COPY . .
# Clear Next.js cache
RUN rm -rf app/.next
RUN pnpm --filter app run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone output contains the full app build inside app/.next/standalone
COPY --from=builder /app/app/.next/standalone ./
COPY --from=builder /app/app/.next/static ./app/.next/static
COPY --from=builder /app/app/public ./app/public
RUN addgroup -g 1001 -S oma && adduser -S oma -u 1001 -G oma
RUN chown -R oma:oma /app
USER oma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
