#!/usr/bin/env bash
# Deploys to Cloudflare Workers: applies migrations to Neon, ensures admins,
# builds with OpenNext and deploys. Needs DATABASE_URL_NON_POOLING (direct Neon
# URL) and Cloudflare credentials (CLOUDFLARE_API_TOKEN) in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL_NON_POOLING:?Set DATABASE_URL_NON_POOLING to the direct Neon URL}"
export DATABASE_URL="${DATABASE_URL:-$DATABASE_URL_NON_POOLING}"

echo "Applying migrations..."
yarn -s prisma migrate deploy

ADMIN_EMAILS="${ADMIN_EMAILS:-yjsoon@tinkertanker.com,alexteo@gmail.com}"
values=""
IFS=',' read -ra emails <<<"$ADMIN_EMAILS"
for raw in "${emails[@]}"; do
  email=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  [[ "$email" == *@*.* ]] || { echo "Skipping invalid admin email: $email"; continue; }
  values+="${values:+, }(gen_random_uuid()::text, '${email//\'/\'\'}', NOW())"
done
if [ -n "$values" ]; then
  echo "Ensuring authorised admins..."
  printf 'INSERT INTO "Admin" (id, email, "createdAt") VALUES %s ON CONFLICT (email) DO NOTHING;\n' "$values" |
    yarn -s prisma db execute --stdin --schema prisma/schema.prisma
fi

yarn cf:build
npx wrangler deploy
