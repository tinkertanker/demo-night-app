# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS builder
ENV SKIP_ENV_VALIDATION=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
# so they must be provided here rather than at container runtime
ARG NEXT_PUBLIC_URL
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["dumb-init", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
