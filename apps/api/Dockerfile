FROM node:26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
# Root-level lockfile is required to install the exact resolved versions
# from pnpm-lock.yaml - installing from apps/api/package.json alone (no
# lockfile) lets pnpm re-resolve transitive deps at build time, silently
# reintroducing CVEs already patched in the workspace lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile --ignore-scripts
COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate
RUN cd apps/api && pnpm build
# `pnpm prune` has no --filter/recursive support, so it must run at the
# workspace root; CI=true suppresses the "reinstall from scratch?" prompt
# pnpm otherwise shows outside a real TTY.
RUN CI=true pnpm prune --prod

FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache openssl
# pnpm's isolated linker only symlinks a package's own dependencies into
# that package's node_modules (e.g. apps/api/node_modules/@nestjs/core),
# using an ABSOLUTE symlink back into the shared /app/node_modules/.pnpm
# store - so both directories must be copied, at the same absolute paths
# they had in the builder, for those symlinks to resolve.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/entrypoint.sh ./apps/api/entrypoint.sh
# npm/npx/corepack ship in the base image but aren't used at runtime
# (entrypoint.sh calls the local prisma binary directly) - their vendored
# deps (tar, ip-address, brace-expansion) trip the vulnerability scan with
# CVEs we can't patch via our own lockfile, so drop them entirely.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  && chmod +x ./apps/api/entrypoint.sh && chown -R node:node /app
USER node
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["./entrypoint.sh"]
