#!/usr/bin/env bash
set -euo pipefail

# Build script for all applications
# Supports building specific apps or all apps

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

show_usage() {
  echo "Usage: $0 [OPTIONS] [APP_NAME]"
  echo ""
  echo "Build applications in the NX monorepo"
  echo ""
  echo "Options:"
  echo "  -h, --help     Show this help message"
  echo "  -a, --all      Build all applications (default)"
  echo "  -p, --prod     Build for production"
  echo "  -w, --watch    Build in watch mode"
  echo ""
  echo "Available apps:"
  echo "  dashboard-api       Dashboard API application"
  echo "  agent-api          Agent API application"
  echo "  agent-gateway      Agent Gateway application"
  echo "  device-adapter     Device Adapter Platform"
  echo ""
  echo "Examples:"
  echo "  $0                 Build all applications"
  echo "  $0 dashboard-api   Build only Dashboard API"
  echo "  $0 --prod          Build all for production"
  echo "  $0 --watch agent-api  Build Agent API in watch mode"
}

build_app() {
  local app_name="$1"
  local build_options="$2"
  
  log "Building $app_name..."
  
  cd "$ROOT_DIR"
  
  if [ "$build_options" = "--watch" ]; then
    nx build "$app_name" --watch
  elif [ "$build_options" = "--prod" ]; then
    nx build "$app_name" --configuration=production
  else
    nx build "$app_name"
  fi
  
  log "$app_name built successfully"
}

build_all() {
  local build_options="$1"
  
  log "Building all applications..."
  
  cd "$ROOT_DIR"
  
  if [ "$build_options" = "--watch" ]; then
    nx run-many --target=build --all --watch
  elif [ "$build_options" = "--prod" ]; then
    nx run-many --target=build --all --configuration=production
  else
    nx run-many --target=build --all --parallel
  fi
  
  log "All applications built successfully"
}

main() {
  local app_name=""
  local build_options=""
  local build_all_flag=true
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_usage
        exit 0
        ;;
      -a|--all)
        build_all_flag=true
        shift
        ;;
      -p|--prod)
        build_options="--prod"
        shift
        ;;
      -w|--watch)
        build_options="--watch"
        shift
        ;;
      dashboard-api|agent-api|agent-gateway|device-adapter-platform)
        app_name="$1"
        build_all_flag=false
        shift
        ;;
      *)
        log "Unknown option: $1"
        show_usage
        exit 1
        ;;
    esac
  done
  
  if [ "$build_all_flag" = true ]; then
    build_all "$build_options"
  else
    build_app "$app_name" "$build_options"
  fi
}

main "$@"