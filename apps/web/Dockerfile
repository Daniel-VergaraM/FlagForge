FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile --ignore-scripts
COPY apps/web ./apps/web
RUN cd apps/web && pnpm build
# `pnpm prune` has no --filter/recursive support, so it must run at the
# workspace root; CI=true suppresses the "reinstall from scratch?" prompt
# pnpm otherwise shows outside a real TTY.
RUN CI=true pnpm prune --prod

FROM node:26-alpine
WORKDIR /app
# libcrypto3 (and other alpine packages) can lag behind their fixed
# version even on the "latest" tag if a build reuses a cached base layer.
RUN apk --no-cache upgrade
# pnpm's isolated linker only symlinks a package's own dependencies into
# that package's node_modules (e.g. apps/web/node_modules/next), using an
# ABSOLUTE symlink back into the shared /app/node_modules/.pnpm store - so
# both directories must be copied, at the same absolute paths they had in
# the builder, for those symlinks to resolve.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/public ./apps/web/public
# npm/npx/corepack ship in the base image but aren't used at runtime
# (CMD calls the local next binary directly) - their vendored deps (tar,
# ip-address, brace-expansion) trip the vulnerability scan with CVEs we
# can't patch via our own lockfile, so drop them entirely.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["./node_modules/.bin/next", "start"]
