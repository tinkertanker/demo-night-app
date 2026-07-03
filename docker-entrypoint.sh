#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Prisma migrations..."
  node ./node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
