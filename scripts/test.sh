#!/usr/bin/env bash
set -euo pipefail

# Testing script for all applications
# Supports unit tests, integration tests, e2e tests, and coverage

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

show_usage() {
  echo "Usage: $0 [OPTIONS] [APP_NAME]"
  echo ""
  echo "Run tests for applications in the NX monorepo"
  echo ""
  echo "Options:"
  echo "  -h, --help       Show this help message"
  echo "  -a, --all        Run tests for all applications (default)"
  echo "  -u, --unit       Run unit tests only"
  echo "  -e, --e2e        Run e2e tests only"
  echo "  -c, --coverage   Run tests with coverage report"
  echo "  -w, --watch      Run tests in watch mode"
  echo "  -v, --verbose    Run tests with verbose output"
  echo ""
  echo "Available apps:"
  echo "  dashboard-api       Dashboard API tests"
  echo "  agent-api          Agent API tests"
  echo "  agent-gateway      Agent Gateway tests"
  echo "  device-adapter     Device Adapter tests"
  echo "  shared-database    Shared database library tests"
  echo "  shared-auth        Shared auth library tests"
  echo ""
  echo "Examples:"
  echo "  $0                     Run all tests"
  echo "  $0 dashboard-api       Run Dashboard API tests only"
  echo "  $0 --coverage          Run all tests with coverage"
  echo "  $0 --e2e               Run all e2e tests"
  echo "  $0 --watch agent-api   Run Agent API tests in watch mode"
}

run_unit_tests() {
  local app_name="$1"
  local options="$2"
  
  log "Running unit tests for $app_name..."
  
  cd "$ROOT_DIR"
  
  local cmd="nx test"
  
  if [ "$app_name" != "all" ]; then
    cmd="$cmd $app_name"
  else
    cmd="nx run-many --target=test --all --parallel"
  fi
  
  if [[ "$options" == *"--coverage"* ]]; then
    cmd="$cmd --coverage"
  fi
  
  if [[ "$options" == *"--watch"* ]]; then
    cmd="$cmd --watch"
  fi
  
  if [[ "$options" == *"--verbose"* ]]; then
    cmd="$cmd --verbose"
  fi
  
  eval "$cmd"
  
  log "Unit tests completed for $app_name"
}

run_e2e_tests() {
  local app_name="$1"
  local options="$2"
  
  log "Running e2e tests for $app_name..."
  
  cd "$ROOT_DIR"
  
  local cmd="nx e2e"
  
  if [ "$app_name" != "all" ]; then
    cmd="$cmd ${app_name}-e2e"
  else
    cmd="nx run-many --target=e2e --all --parallel"
  fi
  
  if [[ "$options" == *"--watch"* ]]; then
    cmd="$cmd --watch"
  fi
  
  if [[ "$options" == *"--verbose"* ]]; then
    cmd="$cmd --verbose"
  fi
  
  eval "$cmd"
  
  log "E2E tests completed for $app_name"
}

run_all_tests() {
  local app_name="$1"
  local options="$2"
  
  log "Running all tests for $app_name..."
  
  # Run unit tests first
  run_unit_tests "$app_name" "$options"
  
  # Run e2e tests if not in watch mode
  if [[ "$options" != *"--watch"* ]]; then
    run_e2e_tests "$app_name" "$options"
  fi
  
  log "All tests completed for $app_name"
}

generate_coverage_report() {
  log "Generating coverage report..."
  
  cd "$ROOT_DIR"
  
  # Run tests with coverage
  nx run-many --target=test --all --parallel --coverage
  
  # Check if coverage directory exists
  if [ -d "coverage" ]; then
    log "Coverage report generated in coverage/ directory"
    
    # Try to open coverage report in browser (optional)
    if command -v xdg-open >/dev/null 2>&1; then
      log "Opening coverage report in browser..."
      xdg-open coverage/lcov-report/index.html 2>/dev/null || true
    elif command -v open >/dev/null 2>&1; then
      log "Opening coverage report in browser..."
      open coverage/lcov-report/index.html 2>/dev/null || true
    fi
  else
    log "Coverage report not found"
  fi
}

main() {
  local app_name="all"
  local test_type="all"
  local options=""
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_usage
        exit 0
        ;;
      -a|--all)
        app_name="all"
        shift
        ;;
      -u|--unit)
        test_type="unit"
        shift
        ;;
      -e|--e2e)
        test_type="e2e"
        shift
        ;;
      -c|--coverage)
        options="$options --coverage"
        shift
        ;;
      -w|--watch)
        options="$options --watch"
        shift
        ;;
      -v|--verbose)
        options="$options --verbose"
        shift
        ;;
      dashboard-api|agent-api|agent-gateway|device-adapter-platform|shared-database|shared-auth)
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
  
  case $test_type in
    unit)
      run_unit_tests "$app_name" "$options"
      ;;
    e2e)
      run_e2e_tests "$app_name" "$options"
      ;;
    all)
      run_all_tests "$app_name" "$options"
      ;;
  esac
  
  # Generate coverage report if requested
  if [[ "$options" == *"--coverage"* ]] && [[ "$options" != *"--watch"* ]]; then
    generate_coverage_report
  fi
}

main "$@"