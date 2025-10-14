#!/usr/bin/env bash
set -euo pipefail

# Lightweight deployment helper invoked from CI after rsync completes.
# Customize service names and dependency installation to match the target host.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUILD_DIRS=(
  "apps/agent-api"
  "apps/dashboard-api"
)

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

install_dependencies() {
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found; skipping dependency install"
    return
  fi

  log "Installing production dependencies for workspace"
  (cd "$ROOT_DIR" && pnpm install --frozen-lockfile --prod) || log "Failed to install workspace dependencies"

  if [ -f "$ROOT_DIR/shared/database/prisma/schema.prisma" ]; then
    log "Generating Prisma client"
    (cd "$ROOT_DIR/shared/database" && pnpm exec prisma generate) || log "Failed to generate Prisma client"
  fi
}

restart_systemd_services() {
  local services=("$@")
  if [ "${#services[@]}" -eq 0 ]; then
    return
  fi

  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not available; skipping systemd restarts"
    return
  fi

  for service in "${services[@]}"; do
    log "Restarting systemd service $service"
    if systemctl restart "$service"; then
      log "systemd service $service restarted successfully"
    else
      log "systemd restart failed for $service"
    fi
  done
}

restart_pm2_processes() {
  local processes=("$@")
  if [ "${#processes[@]}" -eq 0 ]; then
    return
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log "pm2 not available; skipping PM2 reloads"
    return
  fi

  for process in "${processes[@]}"; do
    log "Reloading PM2 process $process"
    if pm2 reload "$process"; then
      log "PM2 process $process reloaded"
    else
      log "PM2 reload failed for $process; attempting restart"
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

  IFS=' ' read -r -a systemd_services <<< "${SYSTEMD_SERVICES:-}"
  IFS=' ' read -r -a pm2_processes <<< "${PM2_PROCESSES:-agent-api dashboard-api}"

  restart_systemd_services "${systemd_services[@]}"
  restart_pm2_processes "${pm2_processes[@]}"

  if [ "${#systemd_services[@]}" -eq 0 ] && [ "${#pm2_processes[@]}" -eq 0 ]; then
    log "No services specified to restart"
    return 1
  fi
}

main "$@"
