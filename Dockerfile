# syntax=docker/dockerfile:1
#
# Mạng có phần mềm kiểm tra TLS (antivirus / proxy công ty ký lại chứng chỉ) thì truyền root CA đó vào:
#   docker build --secret id=extra_ca,src=./corp-ca.pem ...
# Không truyền thì bỏ qua — trên VPS bình thường không cần.

# ---- Cài dependency (không chạy postinstall; prisma generate làm ở bước sau) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=extra_ca \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --ignore-scripts --no-audit --no-fund

# ---- Build web (Next.js standalone). Build không cần kết nối DB. ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# SITE_URL / SITE_NAME được nhúng vào phần prerender (metadata, robots, footer) và EMBED_HOSTS vào
# header CSP lúc build, nên phải truyền vào khi build. Khóa công khai Web Push (NEXT_PUBLIC_) cũng được nhúng lúc build.
ARG SITE_URL=http://localhost:3000
ARG SITE_NAME="Web Phim"
ARG EMBED_HOSTS="https://player.phimapi.com https://*.streamc.xyz https://*.streamvsmov.com"
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV SITE_URL=$SITE_URL SITE_NAME=$SITE_NAME EMBED_HOSTS=$EMBED_HOSTS NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=extra_ca \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npx prisma generate && npm run build

# ---- Image chạy web ----
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# CA của Supabase: DATABASE_URL trỏ tới certs/supabase-ca.crt (sslrootcert) để xác thực TLS
COPY --chown=node:node certs ./certs
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---- Image chạy worker đồng bộ (và lệnh migrate / CLI) ----
# Cài riêng chỉ dependency production (tsx, prisma CLI nằm trong đó) và chạy bằng user node từ đầu,
# tránh chown -R làm nhân đôi node_modules thành một layer mới.
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    --mount=type=secret,id=extra_ca,uid=1000 \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node tsconfig.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src
COPY --chown=node:node worker ./worker
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node certs ./certs
RUN --mount=type=secret,id=extra_ca,uid=1000 \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npx prisma generate
CMD ["npx", "tsx", "worker/index.ts"]
