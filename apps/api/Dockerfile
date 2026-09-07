FROM node:26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json .
RUN npm install -g pnpm && pnpm install
COPY . .
RUN npx prisma generate
RUN pnpm build

FROM node:26-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3001
CMD ["./entrypoint.sh"]
