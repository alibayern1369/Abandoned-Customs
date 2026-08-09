# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# --- Install workspace dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/
COPY packages/import-core/package.json ./packages/import-core/
COPY packages/validator/package.json ./packages/validator/
RUN npm ci

# --- Build Next.js standalone ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/web/package.json ./apps/web/
COPY --from=deps /app/packages/db/package.json ./packages/db/
COPY --from=deps /app/packages/domain/package.json ./packages/domain/
COPY --from=deps /app/packages/import-core/package.json ./packages/import-core/
COPY --from=deps /app/packages/validator/package.json ./packages/validator/
COPY apps/web ./apps/web
COPY packages/db ./packages/db
COPY packages/domain ./packages/domain
COPY packages/import-core ./packages/import-core
COPY packages/validator ./packages/validator
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @metrookeh/web

# --- Production runner ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache postgresql-client \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone Next.js server (monorepo layout preserved under apps/web)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# DB migrate/seed tooling (small isolated install).
# Use a dedicated package.json so dotenv/tsx are production deps
# (they are only devDependencies in packages/db for local development).
WORKDIR /app/db-tools
RUN printf '%s\n' '{"name":"metrookeh-db-tools","private":true,"type":"module","dependencies":{"dotenv":"16.5.0","drizzle-orm":"0.44.2","postgres":"3.4.7","tsx":"4.19.4"}}' > package.json \
  && npm install --omit=dev \
  && npm cache clean --force
COPY packages/db/src ./src
RUN chown -R nextjs:nodejs /app/db-tools

WORKDIR /app
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && chown nextjs:nodejs /entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
