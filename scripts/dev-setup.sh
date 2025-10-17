#!/usr/bin/env bash
set -euo pipefail

# Development environment setup script
# This script sets up the development environment for the Staff Control System

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

check_dependencies() {
  log "Checking required dependencies..."
  
  if ! command -v node >/dev/null 2>&1; then
    log "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
  fi
  
  if ! command -v pnpm >/dev/null 2>&1; then
    log "ERROR: pnpm is not installed. Please install pnpm first."
    log "Run: npm install -g pnpm"
    exit 1
  fi
  
  if ! command -v docker >/dev/null 2>&1; then
    log "WARNING: Docker is not installed. You'll need Docker for PostgreSQL and Redis."
  fi
  
  log "Dependencies check completed."
}

install_packages() {
  log "Installing project dependencies..."
  cd "$ROOT_DIR"
  pnpm install
  log "Dependencies installed successfully."
}

setup_database() {
  log "Setting up database..."
  
  # Check if .env file exists
  if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
      log "Copying .env.example to .env"
      cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
      log "Please update .env file with your database credentials"
    else
      log "WARNING: No .env file found. Please create one with database credentials."
    fi
  fi
  
  # Generate Prisma client
  log "Generating Prisma client..."
  pnpm run db:generate
  
  # Run database migrations
  log "Running database migrations..."
  pnpm run db:migrate
  
  # Seed database
  log "Seeding database..."
  pnpm run db:seed
  
  log "Database setup completed."
}

build_applications() {
  log "Building applications..."
  pnpm run build
  log "Applications built successfully."
}

run_tests() {
  log "Running tests..."
  pnpm run test
  log "Tests completed."
}

main() {
  log "Starting development environment setup..."
  
  check_dependencies
  install_packages
  setup_database
  build_applications
  run_tests
  
  log "Development environment setup completed successfully!"
  log ""
  log "Available commands:"
  log "  pnpm run dev              - Start both APIs in development mode"
  log "  pnpm run serve:dashboard-api - Start Dashboard API only"
  log "  pnpm run serve:agent-api     - Start Agent API only"
  log "  pnpm run db:studio           - Open Prisma Studio"
  log "  pnpm run test                - Run all tests"
  log ""
  log "To start development:"
  log "  pnpm run dev"
}

main "$@"