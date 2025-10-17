# Staff Control System - Development Makefile
# Provides convenient shortcuts for common development tasks

.PHONY: help setup dev build test clean lint format db-setup db-migrate db-seed db-studio

# Default target
help: ## Show this help message
	@echo "Staff Control System - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Complete development environment setup
	@echo "Setting up development environment..."
	@chmod +x scripts/*.sh
	@./scripts/dev-setup.sh

dev: ## Start development servers (dashboard-api + agent-api)
	@echo "Starting development servers..."
	@pnpm run dev

dev-all: ## Start all development servers
	@echo "Starting all development servers..."
	@pnpm run dev:all

build: ## Build all applications
	@echo "Building all applications..."
	@pnpm run build

build-prod: ## Build all applications for production
	@echo "Building for production..."
	@./scripts/build.sh --prod

test: ## Run all tests
	@echo "Running tests..."
	@pnpm run test

test-coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	@./scripts/test.sh --coverage

test-watch: ## Run tests in watch mode
	@echo "Running tests in watch mode..."
	@./scripts/test.sh --watch

lint: ## Lint all code
	@echo "Linting code..."
	@pnpm run lint

lint-fix: ## Lint and fix issues
	@echo "Linting and fixing code..."
	@pnpm run lint:fix

format: ## Format all code
	@echo "Formatting code..."
	@pnpm run format

db-setup: ## Complete database setup (generate + migrate + seed)
	@echo "Setting up database..."
	@./scripts/db-migrate.sh setup

db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	@./scripts/db-migrate.sh migrate

db-seed: ## Seed database with initial data
	@echo "Seeding database..."
	@./scripts/db-migrate.sh seed

db-studio: ## Open Prisma Studio
	@echo "Opening Prisma Studio..."
	@./scripts/db-migrate.sh studio

db-reset: ## Reset database (with confirmation)
	@echo "Resetting database..."
	@./scripts/db-migrate.sh reset

clean: ## Clean build artifacts and cache
	@echo "Cleaning build artifacts..."
	@pnpm run clean

install: ## Install dependencies
	@echo "Installing dependencies..."
	@pnpm install

# Development workflow shortcuts
start: dev ## Alias for dev

serve: dev ## Alias for dev

run: dev ## Alias for dev

# Quick development cycle
quick-test: lint test ## Run linting and tests quickly

full-test: lint test-coverage ## Run full test suite with coverage

# Production preparation
prod-build: clean build-prod test ## Clean, build for production, and test

# Database shortcuts
migrate: db-migrate ## Alias for db-migrate

seed: db-seed ## Alias for db-seed

studio: db-studio ## Alias for db-studio