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
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["./entrypoint.sh"]
