#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

env_value() {
  local key="$1"
  local fallback="${2:-}"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    printf '%s' "$fallback"
    return
  fi
  printf '%s' "${line#*=}"
}

POSTGRES_USER="$(env_value POSTGRES_USER demo_night)"
POSTGRES_DB="$(env_value POSTGRES_DB demo_night_app)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"
mkdir -p "$DEST"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "Dumping postgres to $DEST/postgres.dump"
compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$DEST/postgres.dump"

echo "Saving redis"
compose exec -T redis redis-cli BGSAVE >/dev/null || true
sleep 1
docker cp demo-night-redis:/data/dump.rdb "$DEST/redis-dump.rdb" 2>/dev/null || true
docker cp demo-night-redis:/data/appendonlydir "$DEST/redis-appendonly" 2>/dev/null || true

echo "Wrote $DEST"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
ls -lh "$DEST"
