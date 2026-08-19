#!/bin/bash
# Manual fallback for production deploys. Prefer pushing a v* tag so
# .github/workflows/release.yml merges the tag into main and deploys.
set -euo pipefail

REMOTE_HOST="tinkertanker@dev.tk.sg"
REMOTE_DIR="Docker/demo-night-app"
REPO_URL="git@github.com:tinkertanker/demo-night-app.git"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

PULL=true
SHOW_LOGS=false
TAG=""

for arg in "$@"; do
  case "$arg" in
    --no-pull)
      PULL=false
      ;;
    --logs)
      SHOW_LOGS=true
      ;;
    v*)
      TAG="$arg"
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./deploy.sh [--no-pull] [--logs] [vYYYY.MM.DD]"
      exit 1
      ;;
  esac
done

ssh "$REMOTE_HOST" "mkdir -p Docker"

if ssh "$REMOTE_HOST" "[ -d '$REMOTE_DIR/.git' ]"; then
  if [ -n "$TAG" ]; then
    ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git fetch origin --tags --force && git checkout -f 'refs/tags/$TAG'"
  elif [ "$PULL" = true ]; then
    ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git pull"
  fi
else
  ssh "$REMOTE_HOST" "git clone '$REPO_URL' '$REMOTE_DIR'"
  if [ -n "$TAG" ]; then
    ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git fetch origin --tags --force && git checkout -f 'refs/tags/$TAG'"
  fi
fi

if ! ssh "$REMOTE_HOST" "[ -f '$REMOTE_DIR/$ENV_FILE' ]"; then
  echo "Missing $ENV_FILE on $REMOTE_HOST:$REMOTE_DIR"
  echo "Create it from .env.production.example before deploying."
  exit 1
fi

# Keep the tagged compose file when deploying a tag; otherwise copy the local one.
if [ -z "$TAG" ]; then
  scp "$COMPOSE_FILE" "$REMOTE_HOST:$REMOTE_DIR/"
fi

ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' build"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' up -d"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' ps"

if [ "$SHOW_LOGS" = true ]; then
  ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' logs -f --tail=100 app"
fi
