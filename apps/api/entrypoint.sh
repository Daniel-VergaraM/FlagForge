#!/bin/sh
set -e

# Run Prisma migrations (or db push if no migrations exist yet).
# Uses the local binary directly (not `npx prisma`) - the final image
# has no npm/npx, only the pnpm-installed node_modules.
./node_modules/.bin/prisma migrate deploy || ./node_modules/.bin/prisma db push --accept-data-loss

# Start the NestJS application
exec node dist/src/main
