#!/bin/sh
set -e

# Run Prisma migrations (or db push if no migrations exist yet)
npx prisma migrate deploy || npx prisma db push --accept-data-loss

# Start the NestJS application
exec node dist/src/main
