#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/" && pwd)"
PRISMA_DIR="$ROOT_DIR/shared/database/prisma"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

install_dependencies() {
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found; installing dependencies skipped"
    return
  fi

  log "Installing production dependencies for workspace"
  (cd "$ROOT_DIR" && pnpm install --no-frozen-lockfile --prod) || log "Failed to install workspace dependencies"

  if [ -f "$PRISMA_DIR/models/schema.prisma" ]; then
    log "Generating Prisma client"
    (cd "$PRISMA_DIR" && pnpm exec prisma generate) || log "Failed to generate Prisma client"
  else
    log "Prisma schema not found, 'prisma generate' skipped."
  fi
}

handle_database_migration() {
  local strategy="${DB_MIGRATE_STRATEGY:-none}"
  
  if [ ! -f "$PRISMA_DIR/models/schema.prisma" ]; then
    log "Prisma schema not found, database operations skipped."
    return
  fi

  log "Determining database strategy: '$strategy'"

  case "$strategy" in
    deploy)
      log "Applying production migrations (prisma migrate deploy)..."
      (cd "$PRISMA_DIR" && pnpm exec prisma migrate deploy) || {
        log "ERROR: 'prisma migrate deploy' failed!"
        return 1
      }
      log "Migrations applied successfully."
      ;;
      
    reset)
      log "WARNING: Resetting database completely (prisma migrate reset --force)..."
      (cd "$PRISMA_DIR" && pnpm exec prisma migrate reset --force) || {
        log "ERROR: 'prisma migrate reset' failed!"
        return 1
      }
      
      log "Database reset. Running 'db:seed'..."
      (cd "$PRISMA_DIR" && pnpm exec prisma db seed) || {
        log "ERROR: 'prisma db seed' failed!"
        return 1
      }
      log "Database seeded successfully."
      ;;
      
    none | *)
      log "DB_MIGRATE_STRATEGY is 'none' or unset. Migration skipped."
      ;;
  esac
}

restart_systemd_services() {
  local services=("$@")
  if [ "${#services[@]}" -eq 0 ]; then
    return
  fi

  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not found; systemd restarts skipped"
    return
  fi

  for service in "${services[@]}"; do
    log "Restarting systemd service: $service"
    if systemctl restart "$service"; then
      log "Systemd service $service restarted successfully"
    else
      log "Error restarting systemd service $service"
    fi
  done
}

restart_pm2_processes() {
  local processes=("$@")
  if [ "${#processes[@]}" -eq 0 ]; then
    return
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log "pm2 not found; PM2 reloads skipped"
    return
  fi

  for process in "${processes[@]}"; do
    log "Reloading PM2 process: $process"
    if pm2 reload "$process"; then
      log "PM2 process $process reloaded"
    else
      log "pm2 reload failed for $process; trying restart"
      if pm2 restart "$process"; then
        log "PM2 process $process restarted"
      else
        log "PM2 restart failed for $process"
      fi
    fi
  done
}

main() {
  install_dependencies

  handle_database_migration

  IFS=' ' read -r -a systemd_services <<< "${SYSTEMD_SERVICES:-}"
  IFS=' ' read -r -a pm2_processes <<< "${PM2_PROCESSES:-dashboard-api}"

  restart_systemd_services "${systemd_services[@]}"
  restart_pm2_processes "${pm2_processes[@]}"

  if [ "${#systemd_services[@]}" -eq 0 ] && [ "${#pm2_processes[@]}" -eq 0 ]; then
    log "No services specified to restart"
    return 1
  fi

  log "Deploy completed successfully."
}

main "$@"