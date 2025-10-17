#!/usr/bin/env bash
set -euo pipefail

# Serve script for development
# Supports serving specific apps or multiple apps concurrently

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

show_usage() {
  echo "Usage: $0 [OPTIONS] [APP_NAME]"
  echo ""
  echo "Serve applications in development mode"
  echo ""
  echo "Options:"
  echo "  -h, --help     Show this help message"
  echo "  -a, --all      Serve all main applications (dashboard-api + agent-api)"
  echo "  -f, --full     Serve all applications including gateway and adapter"
  echo ""
  echo "Available apps:"
  echo "  dashboard-api       Dashboard API (port 3000)"
  echo "  agent-api          Agent API (port 3001)"
  echo "  agent-gateway      Agent Gateway (port 3002)"
  echo "  device-adapter     Device Adapter Platform (port 3003)"
  echo ""
  echo "Examples:"
  echo "  $0                 Serve dashboard-api and agent-api"
  echo "  $0 dashboard-api   Serve only Dashboard API"
  echo "  $0 --full          Serve all applications"
}

serve_app() {
  local app_name="$1"
  
  log "Starting $app_name in development mode..."
  
  cd "$ROOT_DIR"
  nx serve "$app_name"
}

serve_multiple() {
  local apps=("$@")
  
  log "Starting multiple applications: ${apps[*]}"
  
  cd "$ROOT_DIR"
  
  # Build the nx serve commands
  local commands=()
  for app in "${apps[@]}"; do
    commands+=("nx serve $app")
  done
  
  # Join commands with " & " for concurrently
  local cmd_string=""
  for i in "${!commands[@]}"; do
    if [ $i -eq 0 ]; then
      cmd_string="\"${commands[$i]}\""
    else
      cmd_string="$cmd_string \"${commands[$i]}\""
    fi
  done
  
  # Use concurrently to run multiple services
  eval "npx concurrently $cmd_string"
}

main() {
  local app_name=""
  local serve_all=false
  local serve_full=false
  
  # Default behavior: serve main APIs
  if [ $# -eq 0 ]; then
    serve_multiple "dashboard-api" "agent-api"
    return
  fi
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_usage
        exit 0
        ;;
      -a|--all)
        serve_all=true
        shift
        ;;
      -f|--full)
        serve_full=true
        shift
        ;;
      dashboard-api|agent-api|agent-gateway|device-adapter-platform)
        app_name="$1"
        shift
        ;;
      *)
        log "Unknown option: $1"
        show_usage
        exit 1
        ;;
    esac
  done
  
  if [ "$serve_full" = true ]; then
    serve_multiple "dashboard-api" "agent-api" "agent-gateway" "device-adapter-platform"
  elif [ "$serve_all" = true ]; then
    serve_multiple "dashboard-api" "agent-api"
  elif [ -n "$app_name" ]; then
    serve_app "$app_name"
  else
    serve_multiple "dashboard-api" "agent-api"
  fi
}

main "$@"