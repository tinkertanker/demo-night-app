#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Prisma migrations..."
  node ./node_modules/prisma/build/index.js migrate deploy
fi

if [ -n "${ADMIN_EMAILS:-}" ]; then
  echo "Ensuring authorised admins..."
  sql="INSERT INTO \"Admin\" (id, email, \"createdAt\") VALUES "
  first=1
  emails="$ADMIN_EMAILS"
  while [ -n "$emails" ]; do
    raw="${emails%%,*}"
    if [ "$raw" = "$emails" ]; then
      emails=""
    else
      emails="${emails#*,}"
    fi
    email=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
    case "$email" in
      *@*.*) ;;
      *)
        echo "Skipping invalid admin email: $email"
        continue
        ;;
    esac
    email_esc=$(printf '%s' "$email" | sed "s/'/''/g")
    if [ "$first" = 1 ]; then
      sql="${sql}(gen_random_uuid()::text, '${email_esc}', NOW())"
      first=0
    else
      sql="${sql}, (gen_random_uuid()::text, '${email_esc}', NOW())"
    fi
  done

  if [ "$first" != 1 ]; then
    sql="${sql} ON CONFLICT (email) DO NOTHING;"
    printf '%s\n' "$sql" | node ./node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma
  fi
fi

exec "$@"
