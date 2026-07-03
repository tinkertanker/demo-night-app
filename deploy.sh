#!/bin/bash
set -euo pipefail

REMOTE_HOST="tinkertanker@dev.tk.sg"
REMOTE_DIR="Docker/demo-night-app"
REPO_URL="git@github.com:tinkertanker/demo-night-app.git"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

PULL=true
SHOW_LOGS=false

for arg in "$@"; do
  case "$arg" in
    --no-pull)
      PULL=false
      ;;
    --logs)
      SHOW_LOGS=true
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./deploy.sh [--no-pull] [--logs]"
      exit 1
      ;;
  esac
done

ssh "$REMOTE_HOST" "mkdir -p Docker"

if ssh "$REMOTE_HOST" "[ -d '$REMOTE_DIR/.git' ]"; then
  if [ "$PULL" = true ]; then
    ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && git pull"
  fi
else
  ssh "$REMOTE_HOST" "git clone '$REPO_URL' '$REMOTE_DIR'"
fi

if ! ssh "$REMOTE_HOST" "[ -f '$REMOTE_DIR/$ENV_FILE' ]"; then
  echo "Missing $ENV_FILE on $REMOTE_HOST:$REMOTE_DIR"
  echo "Create it from .env.production.example before deploying."
  exit 1
fi

scp "$COMPOSE_FILE" "$REMOTE_HOST:$REMOTE_DIR/"

ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' build"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' up -d"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' ps"

if [ "$SHOW_LOGS" = true ]; then
  ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' logs -f --tail=100 app"
fi
