#!/usr/bin/env bash
set -euo pipefail

# Database migration script
# Handles Prisma migrations, seeding, and database operations

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_PATH="shared/database/prisma/schema.prisma"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

show_usage() {
  echo "Usage: $0 [COMMAND] [OPTIONS]"
  echo ""
  echo "Database migration and management commands"
  echo ""
  echo "Commands:"
  echo "  generate       Generate Prisma client"
  echo "  migrate        Run database migrations (development)"
  echo "  deploy         Deploy migrations (production)"
  echo "  reset          Reset database and run migrations"
  echo "  seed           Seed database with initial data"
  echo "  studio         Open Prisma Studio"
  echo "  status         Show migration status"
  echo "  setup          Complete database setup (generate + migrate + seed)"
  echo ""
  echo "Options:"
  echo "  -h, --help     Show this help message"
  echo "  -f, --force    Force operation (for reset command)"
  echo ""
  echo "Examples:"
  echo "  $0 setup           Complete database setup"
  echo "  $0 migrate         Run development migrations"
  echo "  $0 deploy          Deploy migrations to production"
  echo "  $0 reset --force   Force reset database"
}

check_schema() {
  if [ ! -f "$ROOT_DIR/$SCHEMA_PATH" ]; then
    log "ERROR: Prisma schema not found at $SCHEMA_PATH"
    exit 1
  fi
}

generate_client() {
  log "Generating Prisma client..."
  cd "$ROOT_DIR"
  npx prisma generate --schema="$SCHEMA_PATH"
  log "Prisma client generated successfully"
}

run_migrations() {
  log "Running database migrations..."
  cd "$ROOT_DIR"
  npx prisma migrate dev --schema="$SCHEMA_PATH"
  log "Database migrations completed"
}

deploy_migrations() {
  log "Deploying database migrations..."
  cd "$ROOT_DIR"
  npx prisma migrate deploy --schema="$SCHEMA_PATH"
  log "Database migrations deployed"
}

reset_database() {
  local force_flag="$1"
  
  if [ "$force_flag" != "--force" ]; then
    log "WARNING: This will reset your database and delete all data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log "Database reset cancelled"
      return
    fi
  fi
  
  log "Resetting database..."
  cd "$ROOT_DIR"
  npx prisma migrate reset --schema="$SCHEMA_PATH" --force
  log "Database reset completed"
}

seed_database() {
  log "Seeding database..."
  cd "$ROOT_DIR"
  
  if [ -f "shared/database/prisma/seed.ts" ]; then
    npx ts-node shared/database/prisma/seed.ts
    log "Database seeded successfully"
  else
    log "WARNING: No seed file found at shared/database/prisma/seed.ts"
  fi
}

open_studio() {
  log "Opening Prisma Studio..."
  cd "$ROOT_DIR"
  npx prisma studio --schema="$SCHEMA_PATH"
}

show_status() {
  log "Checking migration status..."
  cd "$ROOT_DIR"
  npx prisma migrate status --schema="$SCHEMA_PATH"
}

setup_database() {
  log "Setting up database (generate + migrate + seed)..."
  generate_client
  run_migrations
  seed_database
  log "Database setup completed successfully"
}

main() {
  local command=""
  local force_flag=""
  
  if [ $# -eq 0 ]; then
    show_usage
    exit 1
  fi
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_usage
        exit 0
        ;;
      -f|--force)
        force_flag="--force"
        shift
        ;;
      generate|migrate|deploy|reset|seed|studio|status|setup)
        command="$1"
        shift
        ;;
      *)
        log "Unknown command: $1"
        show_usage
        exit 1
        ;;
    esac
  done
  
  check_schema
  
  case $command in
    generate)
      generate_client
      ;;
    migrate)
      run_migrations
      ;;
    deploy)
      deploy_migrations
      ;;
    reset)
      reset_database "$force_flag"
      ;;
    seed)
      seed_database
      ;;
    studio)
      open_studio
      ;;
    status)
      show_status
      ;;
    setup)
      setup_database
      ;;
    *)
      log "No command specified"
      show_usage
      exit 1
      ;;
  esac
}

main "$@"