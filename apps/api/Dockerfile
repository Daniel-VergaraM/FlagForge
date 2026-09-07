FROM node:26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json .
RUN npm install -g pnpm@9 && pnpm install --ignore-scripts
COPY . .
RUN npx prisma generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["./entrypoint.sh"]
